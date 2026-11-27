
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

  checkInButton.disabled = false;
  checkOutButton.disabled = false;

  await loadAttendance();
  await loadFaceStatus();
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

// ABSENSI GPS

async function attendance(action) {
  if (!currentUser) return;

  employeeMessage.textContent = "Memeriksa lokasi GPS...";
  checkInButton.disabled = true;
  checkOutButton.disabled = true;

  if (!navigator.geolocation) {
    employeeMessage.textContent = "Browser tidak mendukung GPS.";
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

        if (error) {
          employeeMessage.textContent = "Gagal: " + error.message;
        } else {
          employeeMessage.textContent = data;
          await loadAttendance();
        }
      } catch (err) {
        employeeMessage.textContent = err.message;
      }

      enableButtons();
    },
    function(error) {
      employeeMessage.textContent =
        "Gagal mengambil lokasi GPS: " + error.message;
      enableButtons();
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

function enableButtons() {
  checkInButton.disabled = false;
  checkOutButton.disabled = false;
}

checkInButton.addEventListener("click", () => attendance("masuk"));
checkOutButton.addEventListener("click", () => attendance("pulang"));

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
    document.querySelector("section").appendChild(container);
  }

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

// VERIFIKASI WAJAH

async function loadFaceStatus() {
  const { data, error } = await supabaseClient
    .from("verifikasi_wajah")
    .select("status, catatan, created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    faceStatus.textContent = "Gagal memuat status: " + error.message;
    return;
  }

  faceStatus.textContent = data
    ? "Status: " + data.status +
      (data.catatan ? " - " + data.catatan : "")
    : "Status: Belum melakukan verifikasi";
}

startCameraButton.addEventListener("click", async function() {
  if (!faceConsent.checked) {
    faceMessage.textContent =
      "Centang persetujuan sebelum membuka kamera.";
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user"
      },
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

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  faceCamera.srcObject = null;
  faceCamera.style.display = "none";

  startCameraButton.disabled = false;
  captureFaceButton.disabled = true;
  stopCameraButton.disabled = true;
}

stopCameraButton.addEventListener("click", stopCamera);

submitFaceButton.addEventListener("click", async function() {
  if (!capturedPhoto || !currentUser) return;

  submitFaceButton.disabled = true;
  faceMessage.textContent = "Mengirim foto verifikasi...";

  const filePath =
    currentUser.id + "/" + Date.now() + ".jpg";

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

faceConsent.addEventListener("change", function() {
  if (!faceConsent.checked) {
    stopCamera();
    capturedPhoto = null;
    submitFaceButton.disabled = true;
    facePreview.style.display = "none";
  }
});

async function logout() {
  stopCamera();
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

checkEmployee();
