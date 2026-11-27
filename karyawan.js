
const profileForm = document.getElementById("profileForm");
const employeeMessage = document.getElementById("employeeMessage");

const checkInButton = document.getElementById("checkInButton");
const checkOutButton = document.getElementById("checkOutButton");

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

  checkInButton.disabled = false;
  checkOutButton.disabled = false;

  await loadAttendance();
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

async function attendance(action) {
  if (!currentUser) return;

  employeeMessage.textContent = "Memeriksa lokasi GPS...";

  checkInButton.disabled = true;
  checkOutButton.disabled = true;

  if (!navigator.geolocation) {
    employeeMessage.textContent =
      "Browser tidak mendukung GPS.";
    enableButtons();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async function(position) {
      try {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        employeeMessage.textContent = "Menyimpan absensi...";

        const { data, error } = await supabaseClient.rpc(
          "record_attendance",
          {
            p_latitude: latitude,
            p_longitude: longitude,
            p_action: action
          }
        );

        if (error) {
          employeeMessage.textContent =
            "Gagal: " + error.message;
        } else {
          employeeMessage.textContent = data;
          await loadAttendance();
        }
      } catch (err) {
        employeeMessage.textContent =
          "Terjadi kesalahan: " + err.message;
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

checkInButton.addEventListener("click", function() {
  attendance("masuk");
});

checkOutButton.addEventListener("click", function() {
  attendance("pulang");
});

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
    container.textContent =
      "Gagal memuat status absensi: " + error.message;
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

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

checkEmployee();
