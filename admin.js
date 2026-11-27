
// ==============================
// CEK ADMIN DAN LOGOUT
// ==============================

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
// DAFTARKAN KARYAWAN
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
        { body: { nama, email } }
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
        tambahMessage.textContent = "Gagal: " + (data.detail || data.error);
        return;
      }

      tambahMessage.textContent =
        "Undangan berhasil dikirim ke email karyawan!";

      tambahForm.reset();
    } catch (err) {
      tambahMessage.textContent = "Terjadi kesalahan: " + err.message;
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

function formatWaktu(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jakarta"
  });
}

function formatTanggal(value) {
  if (!value) return "-";

  return new Date(value + "T00:00:00").toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta"
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
          <th>No</th><th>Nama</th><th>Nomor Paspor</th>
          <th>Verifikasi</th><th>Tanggal Daftar</th>
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
      id, user_id, tanggal, jam_masuk,
      jam_pulang, status, latitude, longitude
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
    container.textContent = "Gagal memuat nama karyawan: " + profileError.message;
    return;
  }

  const namaMap = {};
  (profiles || []).forEach(profile => {
    namaMap[profile.id] = profile.nama;
  });

  let html = `
    <h2>Data Absensi</h2>
    <p>Total catatan absensi: ${data.length}</p>
    <div style="overflow-x:auto">
      <table border="1" cellpadding="10" cellspacing="0"
        style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th>No</th><th>Nama Karyawan</th><th>Tanggal</th>
            <th>Jam Masuk</th><th>Jam Pulang</th>
            <th>Status</th><th>Lokasi GPS</th>
          </tr>
        </thead>
        <tbody>
  `;

  data.forEach((item, index) => {
    const lokasi =
      item.latitude != null && item.longitude != null
        ? `${escapeHTML(item.latitude)}, ${escapeHTML(item.longitude)}`
        : "-";

    html += `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHTML(namaMap[item.user_id] || "Tidak diketahui")}</td>
        <td>${escapeHTML(formatTanggal(item.tanggal))}</td>
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
// VERIFIKASI WAJAH
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
      photo.style.cssText = "width:100%;max-width:300px;border-radius:10px;";
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

// ==============================
// LAPORAN ABSENSI
// ==============================

let reportRows = [];

async function lihatLaporanAbsensi() {
  const container = document.getElementById("reportContainer");
  const summary = document.getElementById("reportSummary");

  if (!container || !summary) return;

  const startDate = document.getElementById("reportStartDate").value;
  const endDate = document.getElementById("reportEndDate").value;

  if (startDate && endDate && startDate > endDate) {
    alert("Tanggal mulai tidak boleh melewati tanggal akhir.");
    return;
  }

  container.innerHTML = "Memuat laporan absensi...";
  summary.textContent = "Sedang menghitung laporan...";

  let query = supabaseClient
    .from("absensi")
    .select("id, user_id, tanggal, jam_masuk, jam_pulang, status")
    .order("tanggal", { ascending: false });

  if (startDate) query = query.gte("tanggal", startDate);
  if (endDate) query = query.lte("tanggal", endDate);

  const { data, error } = await query;

  if (error) {
    container.textContent = "Gagal mengambil laporan: " + error.message;
    summary.textContent = "Laporan gagal dimuat.";
    reportRows = [];
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "<p>Tidak ada data absensi pada rentang tanggal tersebut.</p>";
    summary.textContent = "Total catatan: 0";
    reportRows = [];
    return;
  }

  const userIds = [...new Set(data.map(item => item.user_id))];

  const { data: profiles, error: profileError } = await supabaseClient
    .from("profiles")
    .select("id, nama, nomor_paspor")
    .in("id", userIds);

  if (profileError) {
    container.textContent = "Gagal mengambil data karyawan: " + profileError.message;
    reportRows = [];
    return;
  }

  const profileMap = {};
  (profiles || []).forEach(profile => {
    profileMap[profile.id] = profile;
  });

  reportRows = data.map(item => {
    const profile = profileMap[item.user_id] || {};

    return {
      nama: profile.nama || "Tidak diketahui",
      nomor_paspor: profile.nomor_paspor || "-",
      tanggal: item.tanggal || "-",
      jam_masuk: item.jam_masuk
        ? new Date(item.jam_masuk).toLocaleTimeString("id-ID", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit"
          })
        : "-",
      jam_pulang: item.jam_pulang
        ? new Date(item.jam_pulang).toLocaleTimeString("id-ID", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit"
          })
        : "-",
      status: item.status || "-"
    };
  });

  const total = reportRows.length;

  const hadir = reportRows.filter(item =>
    String(item.status).toLowerCase() === "hadir"
  ).length;

  const terlambat = reportRows.filter(item =>
    String(item.status).toLowerCase() === "terlambat"
  ).length;

  const belumPulang = reportRows.filter(item =>
    item.jam_masuk !== "-" && item.jam_pulang === "-"
  ).length;

  summary.style.cssText =
    "color:#222!important;background:#f1f5f9!important;padding:15px;border-radius:8px;";

  summary.innerHTML = `
    <strong>Ringkasan Laporan</strong>
    <p>Total catatan absensi: ${total}</p>
    <p>Tepat waktu: ${hadir}</p>
    <p>Terlambat: ${terlambat}</p>
    <p>Belum absen pulang: ${belumPulang}</p>
  `;

  let html = `
    <h3 style="color:#222!important;">Detail Laporan Absensi</h3>
    <div style="overflow-x:auto;background:#fff!important;">
      <table style="width:100%;border-collapse:collapse;background:#fff!important;color:#222!important;">
        <thead>
          <tr style="background:#e2e8f0!important;color:#222!important;">
            <th style="padding:12px;border:1px solid #ccc;color:#222!important;background:#e2e8f0!important;">No</th>
            <th style="padding:12px;border:1px solid #ccc;color:#222!important;background:#e2e8f0!important;">Nama Karyawan</th>
            <th style="padding:12px;border:1px solid #ccc;color:#222!important;background:#e2e8f0!important;">Nomor Paspor</th>
            <th style="padding:12px;border:1px solid #ccc;color:#222!important;background:#e2e8f0!important;">Tanggal</th>
            <th style="padding:12px;border:1px solid #ccc;color:#222!important;background:#e2e8f0!important;">Jam Masuk</th>
            <th style="padding:12px;border:1px solid #ccc;color:#222!important;background:#e2e8f0!important;">Jam Pulang</th>
            <th style="padding:12px;border:1px solid #ccc;color:#222!important;background:#e2e8f0!important;">Status</th>
          </tr>
        </thead>
        <tbody>
  `;

  reportRows.forEach((item, index) => {
    html += `
      <tr style="background:#fff!important;color:#222!important;">
        <td style="padding:12px;border:1px solid #ccc;color:#222!important;background:#fff!important;">${index + 1}</td>
        <td style="padding:12px;border:1px solid #ccc;color:#222!important;background:#fff!important;">${escapeHTML(item.nama)}</td>
        <td style="padding:12px;border:1px solid #ccc;color:#222!important;background:#fff!important;">${escapeHTML(item.nomor_paspor)}</td>
        <td style="padding:12px;border:1px solid #ccc;color:#222!important;background:#fff!important;">${escapeHTML(formatTanggal(item.tanggal))}</td>
        <td style="padding:12px;border:1px solid #ccc;color:#222!important;background:#fff!important;">${escapeHTML(item.jam_masuk)}</td>
        <td style="padding:12px;border:1px solid #ccc;color:#222!important;background:#fff!important;">${escapeHTML(item.jam_pulang)}</td>
        <td style="padding:12px;border:1px solid #ccc;color:#222!important;background:#fff!important;">${escapeHTML(item.status)}</td>
      </tr>
    `;
  });

  html += "</tbody></table></div>";
  container.innerHTML = html;
}

// ==============================
// DOWNLOAD CSV
// ==============================

function downloadLaporanAbsensi() {
  if (!reportRows.length) {
    alert("Tampilkan laporan terlebih dahulu sebelum mengunduh.");
    return;
  }

  function csvValue(value) {
    let text = String(value ?? "");

    if (/^[\s]*[=+\-@]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  }

  const headers = [
    "Nama Karyawan",
    "Nomor Paspor",
    "Tanggal",
    "Jam Masuk",
    "Jam Pulang",
    "Status"
  ];

  const rows = reportRows.map(item => [
    item.nama,
    item.nomor_paspor,
    item.tanggal,
    item.jam_masuk,
    item.jam_pulang,
    item.status
  ]);

  const csvContent = [
    headers.map(csvValue).join(","),
    ...rows.map(row => row.map(csvValue).join(","))
  ].join("\r\n");

  const blob = new Blob(
    ["\uFEFF" + csvContent],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "laporan-absensi-attendpro.csv";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// ==============================
// GRAFIK STATISTIK ABSENSI
// ==============================

let dailyChart = null;
let monthlyChart = null;

async function muatGrafikAbsensi() {
  const message = document.getElementById("chartMessage");

  if (!message) return;

  message.textContent = "Sedang memuat grafik...";

  if (typeof Chart === "undefined") {
    message.textContent =
      "Chart.js gagal dimuat. Periksa koneksi internet.";
    return;
  }

  const { data, error } = await supabaseClient
    .from("absensi")
    .select("tanggal, status")
    .order("tanggal", { ascending: true });

  if (error) {
    message.textContent = "Gagal mengambil data: " + error.message;
    return;
  }

  if (!data || data.length === 0) {
    message.textContent =
      "Belum ada data absensi untuk dibuat grafik.";
    return;
  }

  // GRAFIK HARIAN
  const dailyMap = {};

  data.forEach(item => {
    if (!item.tanggal) return;

    dailyMap[item.tanggal] = (dailyMap[item.tanggal] || 0) + 1;
  });

  const dailyDates = Object.keys(dailyMap)
    .sort()
    .slice(-7);

  const dailyLabels = dailyDates.map(formatTanggal);
  const dailyValues = dailyDates.map(date => dailyMap[date]);

  const dailyCanvas =
    document.getElementById("dailyAttendanceChart");

  if (!dailyCanvas) {
    message.textContent = "Elemen grafik harian tidak ditemukan.";
    return;
  }

  if (dailyChart) dailyChart.destroy();

  dailyChart = new Chart(dailyCanvas, {
    type: "bar",
    data: {
      labels: dailyLabels,
      datasets: [{
        label: "Jumlah Catatan Absensi",
        data: dailyValues,
        backgroundColor: "#2563eb",
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });

  // GRAFIK BULANAN
  const monthlyMap = {};

  data.forEach(item => {
    if (!item.tanggal) return;

    const bulan = item.tanggal.substring(0, 7);
    monthlyMap[bulan] = (monthlyMap[bulan] || 0) + 1;
  });

  const monthKeys = Object.keys(monthlyMap)
    .sort()
    .slice(-12);

  const monthLabels = monthKeys.map(bulan => {
    const [tahun, angkaBulan] = bulan.split("-");

    return new Date(
      Number(tahun),
      Number(angkaBulan) - 1,
      1
    ).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric"
    });
  });

  const monthValues = monthKeys.map(bulan => monthlyMap[bulan]);

  const monthlyCanvas =
    document.getElementById("monthlyAttendanceChart");

  if (!monthlyCanvas) {
    message.textContent = "Elemen grafik bulanan tidak ditemukan.";
    return;
  }

  if (monthlyChart) monthlyChart.destroy();

  monthlyChart = new Chart(monthlyCanvas, {
    type: "line",
    data: {
      labels: monthLabels,
      datasets: [{
        label: "Jumlah Catatan Absensi",
        data: monthValues,
        borderColor: "#16a34a",
        backgroundColor: "rgba(22,163,74,0.15)",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });

  message.textContent = "Grafik berhasil dimuat!";
}

// ==============================
// REKAP KETERLAMBATAN
// ==============================

async function muatRekapKeterlambatan() {
  const summary = document.getElementById("lateSummary");
  const container = document.getElementById("lateReportContainer");

  if (!summary || !container) return;

  summary.textContent = "Memuat rekap keterlambatan...";
  container.innerHTML = "";

  try {
    const { data: absensi, error: absensiError } =
      await supabaseClient
        .from("absensi")
        .select("user_id, tanggal, jam_masuk, status")
        .eq("status", "Terlambat")
        .order("tanggal", { ascending: false });

    if (absensiError) throw absensiError;

    if (!absensi || absensi.length === 0) {
      summary.textContent = "Belum ada karyawan yang terlambat.";
      container.innerHTML = "<p>Data keterlambatan masih kosong.</p>";
      return;
    }

    const userIds = [...new Set(absensi.map(item => item.user_id))];

    const { data: profiles, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("id, nama")
        .in("id", userIds);

    if (profileError) throw profileError;

    const namaKaryawan = {};

    (profiles || []).forEach(profile => {
      namaKaryawan[profile.id] = profile.nama;
    });

    const jumlahTerlambat = {};

    absensi.forEach(item => {
      jumlahTerlambat[item.user_id] =
        (jumlahTerlambat[item.user_id] || 0) + 1;
    });

    const jumlahKaryawan = Object.keys(jumlahTerlambat).length;

    summary.innerHTML = `
      <strong>Total keterlambatan:</strong> ${absensi.length} kali
      <br>
      <strong>Karyawan yang pernah terlambat:</strong> ${jumlahKaryawan} orang
    `;

    let html = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Karyawan</th>
              <th>Tanggal</th>
              <th>Jam Masuk</th>
              <th>Status</th>
              <th>Total Terlambat</th>
            </tr>
          </thead>
          <tbody>
    `;

    absensi.forEach((item, index) => {
      const nama = escapeHTML(
        namaKaryawan[item.user_id] || "Nama tidak ditemukan"
      );

      const tanggal = escapeHTML(
        item.tanggal ? formatTanggal(item.tanggal) : "-"
      );

      const jam = item.jam_masuk
        ? new Date(item.jam_masuk).toLocaleTimeString("id-ID", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          })
        : "-";

      html += `
        <tr>
          <td>${index + 1}</td>
          <td>${nama}</td>
          <td>${tanggal}</td>
          <td>${escapeHTML(jam)}</td>
          <td><strong>Terlambat</strong></td>
          <td>${jumlahTerlambat[item.user_id]} kali</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;

  } catch (error) {
    console.error("Gagal memuat rekap keterlambatan:", error);

    summary.textContent = "Gagal mengambil rekap keterlambatan.";
    container.innerHTML = `
      <p>${escapeHTML(error.message || "Terjadi kesalahan.")}</p>
    `;
  }
}

// ==============================
// JALANKAN ADMIN
// ==============================

checkAdmin();
