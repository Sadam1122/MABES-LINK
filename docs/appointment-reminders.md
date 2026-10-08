# Janji dan pengingat internal

Pembaruan 8 Oktober 2026. Menggantikan aturan lama pengulangan T−30…T0.

## Menggunakan aplikasi

1. Buka **Pekerjaan → Buat janji akuisisi**. Pembuat otomatis memegang kendali;
   anggota pendamping CS/OUTBRANCH dari cabang yang sama bersifat opsional.
2. Pilih status janji. Satu isian **Waktu janji (WIB)** wajib untuk **Terkonfirmasi**.
   Waktu tentatif boleh dicatat tetapi tidak mengaktifkan alarm sebelum konfirmasi.
3. Lokasi boleh kosong. Centang verifikasi hanya setelah memastikan pin usaha
   benar; mengganti pin melepas centang verifikasi. Jangan menebak koordinat.
4. Detail pekerjaan menunjukkan pemegang kendali, pendamping, status jarak,
   dan slot pengingat yang masih akan datang. Klik **Terima pekerjaan** setelah
   waktu janji benar: tindakan ini mengonfirmasi jadwal dan baru mengaktifkan alarm.
   Waktu kosong/lewat ditolak; dialog menjelaskan akibat penerimaan.
   Countdown menuju janji dan slot alarm berasal dari job PostgreSQL versi aktif;
   status diperbarui setiap 15 detik, angka countdown setiap detik.
   Kartu di daftar Akuisisi Nasabah juga memperlihatkan **Alarm berikutnya** dan
   **Menuju janji**. Daftar memakai satu clock bersama dan satu refresh status,
   bukan scheduler/polling pada setiap kartu. Slot belum dibuat, sudah diproses,
   kedaluwarsa, belum diterima atau janji selesai ditampilkan dengan status jelas.
   Pendamping CS/OUTBRANCH cabang sama
   dapat **Ambil alih kendali layanan** dengan konfirmasi; tindakan diaudit,
   pemilik sebelumnya tetap menjadi pendamping. Supervisor/Admin tetap mengikuti
   cakupan izin existing. Akun pembuat harus terhubung ke cabang.
5. Di **Pengaturan Notifikasi**, klik **Aktifkan Suara**, pilih volume/mute dan
   **Tes Suara**. Izin notifikasi OS terpisah dari aktivasi Web Audio. Ringtone
   pribadi tetap lokal di IndexedDB, maksimal 5 MB/30 detik.
   Saat pengingat tiba, modal **Alarm janji** menampilkan waktu WIB, kode,
   nama kontak/usaha, lokasi, pemegang kendali dan next action yang boleh dilihat.
   Alarm berulang dari satu sumber audio sampai **Matikan alarm** atau
   **Ingatkan lagi 1/5/10 menit**, dengan batas bunyi 2 menit. Mute/volume nol
   menghentikan suara; modal tetap dapat dibaca. X/Escape/overlay juga menyimpan
   tindakan Matikan. Bila browser belum aktifkan audio, klik **Bunyikan suara**.
   Setelah navigasi penuh/reload, audio mungkin memerlukan interaksi baru.
   Simpan/edit/hapus, penugasan, follow-up dan overdue hanya memberi notifikasi
   visual, **tanpa bunyi**. Preferensi suara perubahan lama tidak lagi dipakai;
   tidak ada kontrol pengulangan suara CRUD. Suara otomatis hanya dari modal
   pengingat janji; tombol Tes Suara tetap berfungsi atas tindakan manual.
6. Untuk janji akuisisi MABES LINK, gunakan **Janji terlaksana** untuk mengakhiri
   tracking dan membatalkan alarm. Tidak ada readiness layanan pada detail janji;
   layanan dan penggunaan produk tetap memiliki alur terpisah. Kasus layanan
   existing tetap memakai kendali/verification/readiness aslinya.

## Kebijakan jadwal

- T−24 jam untuk semua janji terkonfirmasi.
- **T0: alarm saat waktu janji tiba**, termasuk janji yang dibuat terlalu dekat
  untuk pengingat sebelumnya. Countdown tidak membuat alarm sendiri: slot T0
  disimpan ke PostgreSQL, diproses worker dan diterima melalui SSE.
- Tambahan T−15 menit bila koordinat KCP dan usaha terverifikasi serta jarak
  Haversine **≤1.000 m**; **T−1 jam** bila lebih jauh.
- Lokasi kosong, pin usaha belum diverifikasi/diubah setelah verifikasi, atau
  titik KCP belum dikonfirmasi pengelola: **cadangan T−1 jam**, dengan status jelas.
- Haversine adalah jarak garis lurus, bukan rute jalan/perkiraan waktu tempuh.
- Slot yang sudah lewat saat dibuat/reschedule tidak dibuat ulang. Janji baru
  yang sudah lewat, batal atau selesai tidak mengirim alarm. Slot T0 yang sudah
  tersimpan boleh diproses hanya dalam toleransi dispatch 90 detik setelah jadwal.
- Toleransi dispatch **90 detik** sejak slot: satu tick worker 60 detik dan jitter
  terbatas. Setelah itu job dibatalkan, bukan catch-up terlambat. Worker terhenti
  lama memulihkan lease tetapi tidak mengirim pengingat kadaluwarsa sekaligus.
- Tidak ada pengulangan jadwal otomatis tiap 5 menit. Snooze hanya
  dibuat atas pilihan eksplisit penerima. Jeda 1/5/10 menit dihitung dari waktu
  server, tersimpan di outbox PostgreSQL dan diproses oleh worker terpisah.
  Tick 60 detik berarti notifikasi dapat muncul sampai sekitar 60 detik setelah
  waktu snooze (ditambah latensi SSE), bukan alarm detik-presisi. Pilihan yang
  melewati waktu janji ditolak untuk pengingat sebelum janji. Untuk **alarm T0**,
  jeda 1/5/10 menit boleh sesudah jadwal, paling lama sampai 1 jam setelah waktu
  janji asal; ini bukan perubahan tanggal janji dan tidak diulang otomatis.
  Versi/janji berubah, batal atau selesai membatalkan
  snooze lama. Tiap snooze menghasilkan satu notifikasi baru dengan dedup key.
  Tidak ada pengulangan suara otomatis untuk pembaruan umum.
- Perubahan tanggal/status/kendali menambah versi dan membatalkan job serta
  kelayakan bunyi notifikasi lama. Jika koordinat berubah dan kebijakan jarak
  tidak lagi cocok, worker membatalkan slot tersebut dan membuat versi baru;
  slot yang telah lewat tetap tidak dikejar.
- Janji baru tanpa waktu memakai `dueAt` teknis existing (kolom wajib) tanpa
  menampilkan isian kedua. Janji tersebut tidak dihitung sebagai overdue.
  FollowUp dan tenggat kasus layanan legacy tetap mempertahankan alur existing.

## Konfigurasi KCP 11539 dan worker

Isi **hanya dari verifikasi pengelola** pada environment server web dan worker:

```dotenv
APPOINTMENT_BRANCH_LATITUDE=-6.14621
APPOINTMENT_BRANCH_LONGITUDE=106.82421
APPOINTMENT_BRANCH_VERIFIED_AT=2026-10-08T06:06:48.000Z
WORKER_POLL_INTERVAL_MS=60000
SSE_POLL_INTERVAL_MS=2000
```

Latitude −90…90, longitude −180…180 (0 sah), tanggal verifikasi ISO 8601 UTC
yang sudah lewat. Nilai di atas dikonfirmasi pengguna/pengelola pada 8 Oktober
2026 dan sudah diisi di `.env` lokal; bukan klaim survei bank. Env contoh tetap
kosong untuk deployment yang belum dikonfirmasi: cadangan 1 jam. Pin publik
yang sudah dipakai untuk tampilan peta bukan bukti survei/verifikasi operasional.
Konfigurasi ini hanya berlaku untuk kode cabang `11539`; cabang lain fallback.

```powershell
npm run db:deploy
npm run db:generate
npm run build
npm run start
# Terminal/proses terpisah:
npm run worker
npm run worker:health
npm run diagnose:reminders
```

Untuk development gunakan `npm run dev` (web+worker). Jangan jalankan dua web
berbeda pada port sama. Setelah pembaruan restart proses web/worker milik Anda;
worker melakukan rekonsiliasi job legacy tanpa mengubah akun/waktu janji/pemilik.
Refresh tab aplikasi setelah restart agar bundle alarm lama tidak tetap berjalan.
Compose existing menjalankan migrate → web dan worker terpisah dengan healthcheck
serta restart policy; `.env` server tetap privat. Tidak perlu Redis atau scheduler browser.

SMTP tetap default **nonaktif/dry-run**. Isi SMTP server yang sah dan sender yang
diverifikasi organisasi; jangan memakai kredensial rekaan. Email hanya kode,
jenis pengingat, waktu janji WIB dan tautan ber-login, bukan identitas nasabah.
SMTP accepted bukan bukti inbox. Batas retry/kuota dan UNKNOWN existing tetap
berlaku; deadline pengingat dapat membatalkan retry yang terlalu terlambat.

## Deduplikasi, akses dan keterbatasan

- Job PostgreSQL diklaim atomik dengan SKIP LOCKED/lease/dedup key. Publikasi
  notifikasi dikunci singkat bersama row ServiceCase dan versi dicek kembali;
  transaksi tidak ditahan selama SMTP.
- `/api/notifications/[id]/claim` POST memeriksa sesi, penerima, cabang, ruang data,
  status/versi tugas dan umur notifikasi sebelum update atomik `audioClaimedAt`
  atau `popupClaimedAt`. Dua tab/reconnect/refresh tidak mengklaim ulang.
- Klaim berlaku **per penerima di seluruh tab/perangkat**, bukan per-tab. Ini
  at-most-once attempt, bukan jaminan bunyi fisik: tab mati setelah claim, browser
  menangguhkan audio atau speaker mute tetap dapat menyebabkan bunyi tidak terdengar.
- Kendali dan **semua anggota pendamping yang dipilih** masing-masing menerima
  tiga slot yang masih mendatang (24 jam, berdasarkan jarak, dan waktu janji).
  Klaim pop-up menentukan tab pemilik modal;
  hanya tab tersebut mengklaim audio, sehingga tab lain tidak mengambil suara.
  Matikan/snooze bersifat per penerima, tidak mengubah jadwal anggota lain.
  GET/POST `/api/notifications/[id]/alarm` memeriksa penerima, cabang, penugasan,
  versi dan status janji; POST wajib same-origin serta pilihan jeda tervalidasi.
  Transaksi memakai urutan locking case → notification untuk mencegah konflik,
  sementara unique key `alarm-snooze:<notificationId>` membuat klik ganda idempotent.
- SSE memeriksa DB tiap 2 detik, polling cadangan 5 detik. Tick scheduler 60 detik
  berbeda dari latensi SSE setelah notifikasi tersimpan dan dari waktu SMTP.
- Restart worker menambahkan slot T0 mendatang pada janji versi lama secara
  idempotent, tanpa membatalkan/mengulang pengingat sebelum janji yang sudah ada
  dan tanpa mengubah waktu, akun atau kendali. Reschedule tetap membatalkan semua
  slot dan notifikasi alarm versi lama lalu membuat jadwal baru untuk seluruh anggota.
- Browser harus membuka aplikasi dan audio pernah diaktifkan melalui interaksi.
  Tidak memaksa izin browser/volume sistem; bukan Web Push background. HP terkunci,
  tab tidur, Safari/iOS serta speaker fisik memerlukan pengujian manual.
- Migration `20261008110000_appointment_reminder_receipts` hanya menambah
  `Prospect.locationVerifiedAt` serta tiga timestamp Notification nullable;
  tidak menghapus atau menulis ulang akun/data. Jangan drop kolom setelah receipts
  dipakai; rollback aplikasi harus mempertahankan schema untuk keamanan dedup.
- Migration `20261008140000_alarm_snooze` menambahkan `alarmDismissedAt` dan
  `snoozedUntil` nullable pada Notification; tidak mengubah akun/data existing.
  Jadwal snooze tetap menggunakan OutboxJob yang sudah ada, bukan queue kedua.

## Pengujian terisolasi

```powershell
npm run typecheck
npm run lint
npm test
npm run build
# Server produksi lokal dengan database UI test yang sudah dimigrasi:
$env:TEST_DATABASE_NAME='mabeslink_ui_test_20261008'
$env:TEST_SERVER_PORT='3112'
# Koordinat sintetis uji saja, bukan konfigurasi verifikasi operasional:
$env:APPOINTMENT_BRANCH_LATITUDE='-6.14621'
$env:APPOINTMENT_BRANCH_LONGITUDE='106.82421'
$env:APPOINTMENT_BRANCH_VERIFIED_AT='2026-10-07T00:00:00Z'
npm run start:test
# Terminal kedua dengan TEST_DATABASE_NAME yang sama:
$env:TEST_DATABASE_NAME='mabeslink_ui_test_20261008'
$env:VISUAL_TEST_URL='http://localhost:3112'
npm run test:appointment-browser
```

Harness browser menolak nama DB operasional, memakai akun/password acak
`example.invalid`, tidak mengirim SMTP, menyalakan worker terpisah, lalu
membersihkan hanya fixture miliknya. Jangan menjalankannya ke server operasional.
Hasil aktual terbaru dicatat di IMPLEMENTATION_STATUS.md, bukan asumsi semua
browser/perangkat telah diuji. Screenshot/data hasil uji lokal berada di
`.artifacts/appointment-smoke/` dan tidak berisi data nasabah nyata.

## Product Holding di Mapping

Bagian **Product Holding** menggantikan judul Discovery & peluang relevan.
Checklist berkelompok dan pencarian mencakup 38 pilihan produk/kanal, termasuk
Tabungan NOW, Livin’/Merchant/Food/Sukha, KUM/KUR, CC serta Kopra MCM/H2H/Portal/
Partnership dan layanan bisnis. `KOPRA_CASH_MANAGEMENT` tetap kode existing untuk
MCM: tidak membuat kode duplikat atau mengubah holding yang sudah tersimpan.
Default tetap **Belum tahu/belum ditanya**: pilihan baru dapat dicentang setelah
**Sudah ditanya/dikonfirmasi**, bukan disimpulkan dari sektor. Lainnya tersedia
untuk varian yang belum tercantum; ini bukan klaim semua varian katalog bank
telah lengkap atau cabang berwenang menawarkan semuanya.

Nama dirujuk ke kanal publik resmi, antara lain [Kopra](https://www.bankmandiri.co.id/en/web/guest/kopra-by-mandiri),
[Cash Management](https://www.bankmandiri.co.id/in/cash-management1),
[Livin’ Food](https://www.bankmandiri.co.id/en/livin/food),
[Livin’/Sukha](https://go.bankmandiri.co.id/livin), dan
[Kredit usaha mikro](https://www.bankmandiri.co.id/in/usahamikro).
Ketersediaan/otorisasi produk tetap perlu konfirmasi internal. Holding berbeda
dari penawaran/response; penawaran tetap dibatasi `MAPPING_APPROVED_PRODUCTS`
di server. Checklist disimpan ke entitas MappingDiscovery existing, perubahan
holding masuk audit, format Excel Mapping 14 kolom tidak ditambah field sensitif.
