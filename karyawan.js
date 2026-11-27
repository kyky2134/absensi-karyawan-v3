
 // ==============================
 // ABSENSI GPS + NOTIFIKASI
 // ==============================

function showAttendanceNotification(message, status) {
  employeeMessage.textContent = message;

  employeeMessage.style.display = "block";
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

async function attendance(action) {
  if (!currentUser) return;

  employeeMessage.textContent = "Memeriksa lokasi GPS...";
  checkInButton.disabled = true;
  checkOutButton.disabled = true;

  if (!navigator.geolocation) {
    showAttendanceNotification(
      "Browser tidak mendukung GPS.",
      "error"
    );
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
          showAttendanceNotification(
            "Gagal: " + error.message,
            "error"
          );
        } else {
          const result = String(data || "");

          if (
            action === "masuk" &&
            result.toLowerCase().includes("terlambat")
          ) {
            showAttendanceNotification(
              "⚠️ PEMBERITAHUAN KETERLAMBATAN\n\n" +
              "Kamu tercatat terlambat hari ini.\n" +
              "Jam masuk kantor adalah pukul 07.00 WIB.\n\n" +
              result,
              "terlambat"
            );
          } else if (
            action === "masuk" &&
            result.toLowerCase().includes("tepat waktu")
          ) {
            showAttendanceNotification(
              "✅ ABSEN BERHASIL\n\n" +
              "Kamu tercatat tepat waktu. Selamat bekerja!\n\n" +
              result,
              "tepat"
            );
          } else {
            showAttendanceNotification(
              "✅ " + result,
              "tepat"
            );
          }

          await loadAttendance();
          await lihatRiwayatAbsensi();
        }
      } catch (err) {
        showAttendanceNotification(
          "Terjadi kesalahan: " + err.message,
          "error"
        );
      }

      enableButtons();
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

function enableButtons() {
  checkInButton.disabled = false;
  checkOutButton.disabled = false;
}

checkInButton.addEventListener("click", () => attendance("masuk"));
checkOutButton.addEventListener("click", () => attendance("pulang"));
