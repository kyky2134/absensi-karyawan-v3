
const profileForm = document.getElementById("profileForm");
const employeeMessage = document.getElementById("employeeMessage");

const checkInButton = document.getElementById("checkInButton");
const checkOutButton = document.getElementById("checkOutButton");

const faceCamera = document.getElementById("faceCamera");
const faceCanvas = document.getElementById("faceCanvas");
const facePreview = document.getElementById("facePreview");

const faceConsent = document.getElementById("faceConsent");
const startCameraButton = document.getElementById("startCameraButton");
const captureFaceButton = document.getElementById("captureFaceButton");
const submitFaceButton = document.getElementById("submitFaceButton");
const stopCameraButton = document.getElementById("stopCameraButton");

const faceMessage = document.getElementById("faceMessage");
const faceStatus = document.getElementById("faceStatus");

let currentUser = null;
let cameraStream = null;
let capturedPhoto = null;

function showMessage(message) {
  if (employeeMessage) {
    employeeMessage.textContent = message;
    employeeMessage.style.display = "block";
  }
}

// ==============================
// CEK AKUN DAN MUAT PROFIL
// ==============================

async function checkEmployee() {
  try {
    showMessage("Memuat profil...");

    if (!window.supabase || typeof supabaseClient === "undefined") {
      throw new Error("Supabase belum terhubung. Periksa config.js.");
    }

    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    const user = sessionData?.session?.user;

    if (!user) {
      window.location.href = "index.html";
      return;
    }

    currentUser = user;

    const { data: profile, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("id, nama, nomor_paspor, role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      throw new Error("Profil tidak ditemukan untuk akun ini.");
    }

    if (profile.role !== "karyawan") {
      showMessage("Akun ini bukan akun karyawan.");
      await supabaseClient.auth.signOut();
      window.location.href = "index.html";
      return;
    }

    const employeeName = document.getElementById("employeeName");
    const namaInput = document.getElementById("nama");
    const pasporInput = document.getElementById("nomorPaspor");

    if (employeeName) {
      employeeName.textContent =
        "Selamat datang, " + (profile.nama || "Karyawan");
    }

    if (namaInput) namaInput.value = profile.nama || "";
    if (pasporInput) pasporInput.value = profile.nomor_paspor || "";

    if (checkInButton) checkInButton.disabled = false;
    if (checkOutButton) checkOutButton.disabled = false;

    await loadAttendance();
    await loadFaceStatus();

    showMessage("Profil berhasil dimuat.");

  } catch (error) {
    console.error("Kesalahan memuat profil:", error);
    showMessage("Gagal memuat profil: " + error.message);
  }
}

// ==============================
// SIMPAN PROFIL
// ==============================

if (profileForm) {
  profileForm.addEventListener("submit", async function(e) {
    e.preventDefault();

    if (!currentUser) return;

    const nama = document.getElementById("nama").value.trim();
    const nomorPaspor =
      document.getElementById("nomorPaspor").value.trim();

    showMessage("Menyimpan profil...");

    const { error } = await supabaseClient
      .from("profiles")
      .update({
        nama,
        nomor_paspor: nomorPaspor
      })
      .eq("id", currentUser.id);

    if (error) {
      showMessage("Gagal menyimpan: " + error.message);
      return;
    }

    document.getElementById("employeeName").textContent =
      "Selamat datang, " + nama;

    showMessage("Profil berhasil disimpan!");
  });
}

// ==============================
// NOTIFIKASI ABSENSI
// ==============================

function showAttendanceNotification(message, status) {
  showMessage(message);

  if (!employeeMessage) return;

  employeeMessage.style.padding = "14px";
  employeeMessage.style.marginTop = "12px";
  employeeMessage.style.borderRadius = "10px";
  employeeMessage.style.fontWeight = "bold";
  employeeMessage.style.whiteSpace = "pre-line";

  if (status === "terlambat") {
    employeeMessage.style.background = "#f8d7da";
    employeeMessage.style.color = "#842029";
    employeeMessage.style.border = "1px solid #f5c2c7";
  } else if (status === "tepat") {
    employeeMessage.style.background = "#d1e7dd";
    employeeMessage.style.color = "#0f5132";
    employeeMessage.style.border = "1px solid #badbcc";
  } else {
    employeeMessage.style.background = "#fff3cd";
    employeeMessage.style.color = "#664d03";
    employeeMessage.style.border = "1px solid #ffecb5";
  }
}

// ==============================
// ABSENSI GPS
// ==============================

function enableButtons() {
  if (checkInButton) checkInButton.disabled = false;
  if (checkOutButton) checkOutButton.disabled = false;
}

async function attendance(action) {
  if (!currentUser) return;

  showMessage("Memeriksa lokasi GPS...");

  if (checkInButton) checkInButton.disabled = true;
  if (checkOutButton) checkOutButton.disabled = true;

  if (!navigator.geolocation) {
    showAttendanceNotification("Browser tidak mendukung GPS.", "error");
    enableButtons();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async function(position) {
      try {
        const { data, error } = await supabaseClient.rpc(
          "record_attendance",
          {
            p_latitude: position.coords.latitude,
            p_longitude: position.coords.longitude,
            p_action: action
          }
        );

        if (error) throw error;

        const result = String(data || "");
        const normalized = result.toLowerCase();

        if (action === "masuk" && normalized.includes("terlambat")) {
          showAttendanceNotification(
            "⚠️ PEMBERITAHUAN KETERLAMBATAN\n\n" + result,
            "terlambat"
          );
        } else if (
          action === "masuk" &&
          normalized.includes("tepat waktu")
        ) {
          showAttendanceNotification(
            "✅ ABSEN BERHASIL\nKamu tercatat tepat waktu.\n\n" + result,
            "tepat"
          );
        } else {
          showAttendanceNotification("✅ " + result, "tepat");
        }

        await loadAttendance();
        await lihatRiwayatAbsensi();

      } catch (error) {
        showAttendanceNotification(
          "Gagal melakukan absensi: " + error.message,
          "error"
        );
      } finally {
        enableButtons();
      }
    },
    function(error) {
      showAttendanceNotification(
        "Gagal mengambil lokasi GPS: " + error.message,
        "error"
      );
      enableButtons();
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

if (checkInButton) {
  checkInButton.addEventListener("click", () => attendance("masuk"));
}

if (checkOutButton) {
  checkOutButton.addEventListener("click", () => attendance("pulang"));
}

// ==============================
// TAMPILKAN ABSENSI HARI INI
// ==============================

async function loadAttendance() {
  if (!currentUser) return;

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta"
  });

  const { data, error } = await supabaseClient
    .from("absensi")
    .select("tanggal, jam_masuk, jam_pulang, status")
    .eq("user_id", currentUser.id)
    .eq("tanggal", today)
    .maybeSingle();

  let container = document.getElementById("attendanceStatus");

  if (!container) {
    container = document.createElement("div");
    container.id = "attendanceStatus";

    const section = document.querySelector("section");
    if (section) section.appendChild(container);
  }

  if (!container) return;

  if (error) {
    container.textContent = "Gagal memuat absensi: " + error.message;
    return;
  }

  if (!data) {
    container.textContent = "Status hari ini: Belum absen";
    return;
  }

  const masuk = data.jam_masuk
    ? new Date(data.jam_masuk).toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "-";

  const pulang = data.jam_pulang
    ? new Date(data.jam_pulang).toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "Belum absen pulang";

  container.innerHTML = `
    <h3>Status Absensi Hari Ini</h3>
    <p>Masuk: ${masuk}</p>
    <p>Pulang: ${pulang}</p>
    <p>Status: ${data.status || "-"}</p>
  `;
}

// ==============================
// RIWAYAT ABSENSI
// ==============================

async function lihatRiwayatAbsensi() {
  const container =
    document.getElementById("riwayatAbsensiContainer");

  if (!currentUser || !container) return;

  container.textContent = "Memuat riwayat absensi...";

  const { data, error } = await supabaseClient
    .from("absensi")
    .select("tanggal, jam_masuk, jam_pulang, status")
    .eq("user_id", currentUser.id)
    .order("tanggal", { ascending: false })
    .limit(30);

  if (error) {
    container.textContent =
      "Gagal mengambil riwayat: " + error.message;
    return;
  }

  if (!data || data.length === 0) {
    container.textContent = "Belum ada riwayat absensi.";
    return;
  }

  function formatTanggal(tanggal) {
    if (!tanggal) return "-";

    return new Date(tanggal + "T00:00:00").toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta"
      }
    );
  }

  function formatJam(jam) {
    if (!jam) return "-";

    return new Date(jam).toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  const rows = data.map(item => `
    <tr>
      <td>${formatTanggal(item.tanggal)}</td>
      <td>${formatJam(item.jam_masuk)}</td>
      <td>${formatJam(item.jam_pulang)}</td>
      <td>${item.status || "-"}</td>
    </tr>
  `).join("");

  container.innerHTML = `
    <p>Menampilkan maksimal 30 riwayat absensi terbaru.</p>
    <div class="history-wrapper">
      <table class="history-table">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Jam Masuk</th>
            <th>Jam Pulang</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ==============================
// STATUS VERIFIKASI WAJAH
// ==============================

async function loadFaceStatus() {
  if (!currentUser || !faceStatus) return;

  faceStatus.textContent = "Memeriksa status verifikasi...";

  const { data, error } = await supabaseClient
    .from("verifikasi_wajah")
    .select("status, catatan, created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    faceStatus.textContent =
      "Gagal memuat status: " + error.message;
    return;
  }

  if (!data) {
    faceStatus.textContent =
      "BELUM VERIFIKASI\nSilakan kirim foto untuk diperiksa Admin.";

    if (faceMessage) {
      faceMessage.textContent = "Kamu belum mengirim foto verifikasi.";
    }
    return;
  }

  if (data.status === "disetujui") {
    faceStatus.textContent =
      "VERIFIKASI DISETUJUI\nAkun kamu sudah disetujui Admin.";

    if (faceMessage) faceMessage.textContent = "Verifikasi berhasil!";
  } else if (data.status === "ditolak") {
    faceStatus.textContent =
      "VERIFIKASI DITOLAK\nAlasan: " +
      (data.catatan || "Silakan hubungi Admin.");

    if (faceMessage) {
      faceMessage.textContent = "Pengajuan ditolak.";
    }
  } else {
    faceStatus.textContent =
      "MENUNGGU PEMERIKSAAN\nFoto kamu sedang diperiksa Admin.";

    if (faceMessage) {
      faceMessage.textContent = "Menunggu pemeriksaan Admin.";
    }
  }

  faceStatus.style.whiteSpace = "pre-line";
}

// ==============================
// BUKA KAMERA
// ==============================

if (startCameraButton) {
  startCameraButton.addEventListener("click", async function() {
    if (!faceConsent || !faceConsent.checked) {
      if (faceMessage) {
        faceMessage.textContent =
          "Centang persetujuan sebelum membuka kamera.";
      }
      return;
    }

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });

      faceCamera.srcObject = cameraStream;
      faceCamera.style.display = "block";

      startCameraButton.disabled = true;
      captureFaceButton.disabled = false;
      stopCameraButton.disabled = false;

      faceMessage.textContent = "Kamera aktif. Silakan ambil foto.";
    } catch (error) {
      faceMessage.textContent =
        "Tidak bisa membuka kamera: " + error.message;
    }
  });
}

// ==============================
// AMBIL FOTO
// ==============================

if (captureFaceButton) {
  captureFaceButton.addEventListener("click", function() {
    if (!cameraStream || !faceCamera.videoWidth) {
      faceMessage.textContent = "Kamera belum siap.";
      return;
    }

    faceCanvas.width = faceCamera.videoWidth;
    faceCanvas.height = faceCamera.videoHeight;

    const context = faceCanvas.getContext("2d");

    context.drawImage(
      faceCamera,
      0,
      0,
      faceCanvas.width,
      faceCanvas.height
    );

    faceCanvas.toBlob(function(blob) {
      if (!blob) {
        faceMessage.textContent = "Gagal mengambil foto.";
        return;
      }

      capturedPhoto = blob;
      facePreview.src = URL.createObjectURL(blob);
      facePreview.style.display = "block";
      submitFaceButton.disabled = false;

      faceMessage.textContent =
        "Foto berhasil diambil. Periksa pratinjau sebelum mengirim.";
    }, "image/jpeg", 0.85);

    stopCamera();
  });
}

// ==============================
// MATIKAN KAMERA
// ==============================

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  if (faceCamera) {
    faceCamera.srcObject = null;
    faceCamera.style.display = "none";
  }

  if (startCameraButton) startCameraButton.disabled = false;
  if (captureFaceButton) captureFaceButton.disabled = true;
  if (stopCameraButton) stopCameraButton.disabled = true;
}

if (stopCameraButton) {
  stopCameraButton.addEventListener("click", stopCamera);
}

// ==============================
// KIRIM FOTO VERIFIKASI
// ==============================

if (submitFaceButton) {
  submitFaceButton.addEventListener("click", async function() {
    if (!capturedPhoto || !currentUser) return;

    submitFaceButton.disabled = true;
    faceMessage.textContent = "Mengirim foto verifikasi...";

    const filePath = currentUser.id + "/" + Date.now() + ".jpg";

    try {
      const { error: uploadError } = await supabaseClient.storage
        .from("verifikasi-wajah")
        .upload(filePath, capturedPhoto, {
          contentType: "image/jpeg",
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabaseClient
        .from("verifikasi_wajah")
        .insert({
          user_id: currentUser.id,
          storage_path: filePath,
          status: "menunggu"
        });

      if (insertError) {
        await supabaseClient.storage
          .from("verifikasi-wajah")
          .remove([filePath]);

        throw insertError;
      }

      faceMessage.textContent =
        "Foto berhasil dikirim. Menunggu pemeriksaan Admin.";

      capturedPhoto = null;
      facePreview.style.display = "none";
      facePreview.src = "";

      await loadFaceStatus();

    } catch (error) {
      faceMessage.textContent = "Gagal: " + error.message;
      submitFaceButton.disabled = false;
    }
  });
}

// ==============================
// PERSETUJUAN KAMERA
// ==============================

if (faceConsent) {
  faceConsent.addEventListener("change", function() {
    if (!faceConsent.checked) {
      stopCamera();

      capturedPhoto = null;

      if (submitFaceButton) submitFaceButton.disabled = true;

      if (facePreview) {
        facePreview.style.display = "none";
        facePreview.src = "";
      }
    }
  });
}

// ==============================
// LOGOUT
// ==============================

async function logout() {
  stopCamera();

  await supabaseClient.auth.signOut();

  window.location.href = "index.html";
}

// ==============================
// JALANKAN APLIKASI
// ==============================

checkEmployee();


// ==================================
// FITUR PENGAJUAN IZIN / CUTI
// ==================================

const izinForm = document.getElementById("izinForm");
const izinMessage = document.getElementById("izinMessage");
const muatIzinButton = document.getElementById("muatIzinButton");
const riwayatIzinContainer =
  document.getElementById("riwayatIzinContainer");

function escapeIzinHTML(value) {
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

function formatTanggalIzin(tanggal) {
  if (!tanggal) return "-";

  return new Date(tanggal + "T00:00:00").toLocaleDateString(
    "id-ID",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta"
    }
  );
}

// KIRIM PENGAJUAN
if (izinForm) {
  izinForm.addEventListener("submit", async function(e) {
    e.preventDefault();

    if (!currentUser) {
      izinMessage.textContent = "Akun belum terhubung. Silakan login ulang.";
      return;
    }

    const jenis = document.getElementById("jenisIzin").value;
    const tanggalMulai =
      document.getElementById("tanggalMulai").value;
    const tanggalSelesai =
      document.getElementById("tanggalSelesai").value;
    const alasan =
      document.getElementById("alasanIzin").value.trim();

    if (!jenis || !tanggalMulai || !tanggalSelesai || !alasan) {
      izinMessage.textContent = "Lengkapi semua data pengajuan.";
      return;
    }

    if (tanggalSelesai < tanggalMulai) {
      izinMessage.textContent =
        "Tanggal selesai tidak boleh sebelum tanggal mulai.";
      return;
    }

    if (alasan.length < 5) {
      izinMessage.textContent =
        "Alasan pengajuan minimal 5 karakter.";
      return;
    }

    const tombol = document.getElementById("kirimIzinButton");
    tombol.disabled = true;
    izinMessage.textContent = "Mengirim pengajuan...";

    try {
      const { error } = await supabaseClient
        .from("pengajuan_izin")
        .insert({
          user_id: currentUser.id,
          jenis: jenis,
          tanggal_mulai: tanggalMulai,
          tanggal_selesai: tanggalSelesai,
          alasan: alasan
        });

      if (error) throw error;

      izinMessage.textContent =
        "Pengajuan berhasil dikirim! Menunggu persetujuan Admin.";

      izinForm.reset();

      await loadRiwayatIzin();

    } catch (error) {
      console.error("Pengajuan izin:", error);
      izinMessage.textContent =
        "Gagal mengirim pengajuan: " + error.message;
    } finally {
      tombol.disabled = false;
    }
  });
}

// MUAT RIWAYAT PENGAJUAN
async function loadRiwayatIzin() {
  if (!currentUser || !riwayatIzinContainer) return;

  riwayatIzinContainer.textContent =
    "Memuat riwayat pengajuan...";

  try {
    const { data, error } = await supabaseClient
      .from("pengajuan_izin")
      .select(
        "id, jenis, tanggal_mulai, tanggal_selesai, alasan, status, catatan_admin, created_at"
      )
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      riwayatIzinContainer.textContent =
        "Belum ada pengajuan izin atau cuti.";
      return;
    }

    const rows = data.map(item => {
      let statusLabel = item.status;

      if (item.status === "menunggu") {
        statusLabel = "Menunggu";
      } else if (item.status === "disetujui") {
        statusLabel = "Disetujui";
      } else if (item.status === "ditolak") {
        statusLabel = "Ditolak";
      }

      return `
        <tr>
          <td>${escapeIzinHTML(item.jenis)}</td>
          <td>${escapeIzinHTML(formatTanggalIzin(item.tanggal_mulai))}</td>
          <td>${escapeIzinHTML(formatTanggalIzin(item.tanggal_selesai))}</td>
          <td>${escapeIzinHTML(item.alasan)}</td>
          <td>${escapeIzinHTML(statusLabel)}</td>
          <td>${escapeIzinHTML(item.catatan_admin || "-")}</td>
        </tr>
      `;
    }).join("");

    riwayatIzinContainer.innerHTML = `
      <div class="history-wrapper">
        <table class="history-table">
          <thead>
            <tr>
              <th>Jenis</th>
              <th>Tanggal Mulai</th>
              <th>Tanggal Selesai</th>
              <th>Alasan</th>
              <th>Status</th>
              <th>Catatan Admin</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

  } catch (error) {
    console.error("Riwayat izin:", error);
    riwayatIzinContainer.textContent =
      "Gagal memuat riwayat: " + error.message;
  }
}

// TOMBOL MUAT RIWAYAT
if (muatIzinButton) {
  muatIzinButton.addEventListener("click", loadRiwayatIzin);
}
