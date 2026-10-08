# Status Implementasi MABES LINK

Tanggal perubahan terakhir: 8 Oktober 2026 (Asia/Jakarta)

## Alarm saat waktu janji dan setelah snooze/extend

- Plan kini berisi T−24 jam, T−15 menit/T−1 jam berdasarkan jarak, dan **T0**.
  Slot T0 memakai enum existing `APPOINTMENT_ACTION_DUE`, payload versi V2 dan
  dedup key per case/version/recipient. Tidak memerlukan migration schema.
- Worker mengizinkan publikasi T0 hingga 90 detik setelah jadwal, bukan membatalkannya
  karena waktu janji telah tiba. Slot kedaluwarsa tetap dibatalkan. Modal/suara tetap
  menggunakan claim atomik penerima, akses cabang/penugasan dan versi jadwal aktif.
- Ingatkan lagi 1/5/10 menit pada alarm T0 menghasilkan job/notifikasi/modal/suara
  baru. Batas eksplisit hingga 1 jam setelah jadwal janji; pengingat sebelum janji
  masih tidak boleh disnooze melewati waktu janji. Bukan pengulangan otomatis dan
  bukan mengubah jam janji. Dismiss/mute/volume/aktivasi audio tetap berlaku.
- Extend/reschedule membatalkan semua reminder/snooze/notifikasi versi lama dan
  membuat versi baru untuk kendali serta seluruh pendamping. Startup worker
  menambahkan T0 pada janji existing yang masih mendatang tanpa mengulang pengingat
  sebelumnya, mengubah akun, reset database atau mengaktifkan SMTP.
- Kartu/detail membaca T0 dan snooze sesudah waktu janji dari outbox. Saat countdown
  nol dan job masih menunggu, tampil **Waktunya janji / Menunggu proses worker**.
  Default worker 60 detik dan SSE 2 detik: tidak menjanjikan alarm detik-presisi
  atau bunyi saat tab/HP tidur. Audio browser/speaker harus tetap diizinkan.
- Pemeriksaan aktual: `npm run typecheck`, `npm run lint`, `npm run build` lulus;
  `npm test` **104 lulus, 2 skip**, 20 file (dua workbook sumber lama tidak tersedia).
  Tes integrasi meliputi T0/WIB, semua pendamping, expiry, claim atomik, restart dua
  worker tanpa pengulangan pengingat lama, snooze sesudah janji serta reschedule.
- Smoke browser **72 pemeriksaan lulus**, Edge/Chromium headless, production build
  lokal dan database UI test terisolasi. Jalur nyata worker → PostgreSQL → SSE →
  modal → Web Audio diuji untuk pengingat awal, T0 pada jam janji yang diperpanjang,
  serta snooze T0 1 menit. Jadwal lama senyap; hanya satu modal/sumber audio pada
  dua tab. Mute/volume, role/cabang, countdown kartu, form/tracking pada
  360/390/768/1440 px dan modal/holding desktop/HP juga lulus.
  Bukti `.artifacts/appointment-smoke/results.json` (08:59:06 UTC) dan
  `due-time-alarm.png`. Akun/data fixture dibersihkan; SMTP nonaktif.
- Bunyi fisik speaker, HP terkunci, Safari/iOS dan browser lain tetap perlu tes
  manual. Guidebook PDF dari audit sebelumnya belum menambahkan screenshot T0;
  panduan jadwal terbaru ada di `docs/appointment-reminders.md` dan README.

## Countdown kartu janji dan suara khusus modal alarm

- Kartu Akuisisi Nasabah `/work` sekarang menampilkan countdown **Alarm berikutnya**
  dan **Menuju janji** secara terpisah. Jadwal berasal dari outbox PostgreSQL versi
  aktif dan penerima sesuai role/cabang/penugasan. Tidak menebak jadwal jika job
  belum dibuat; kartu belum diterima meminta **Terima pekerjaan**, janji terminal
  menonaktifkan timer dan slot kedaluwarsa tidak dihitung lagi.
- `AppointmentCardClockProvider` memakai satu tick 1 detik dan satu refresh server
  15 detik untuk seluruh daftar (bukan polling per kartu). Tab tersembunyi tidak
  memicu refresh server; kembali ke tab memperbarui status. Timer tidak membuat job,
  tidak memainkan audio dan tidak menggantikan worker 60 detik/SSE 2 detik.
- Simpan/edit/hapus/penugasan, follow-up dan overdue sekarang **visual saja**:
  toast/notifikasi tersimpan tetap ada, jalur audio umum di notification-center
  dihapus. Preferensi CRUD lama tidak dapat mengaktifkannya lagi. Notifikasi OS
  memakai `silent: true`; suara otomatis hanya oleh `AppointmentAlarmDialog`.
  Tes Suara manual tetap tersedia. Kontrol pengulangan suara perubahan dihapus.
- Pengingat baru membuka modal segera meski audio belum aktif, bukan menunggu klik
  Simpan untuk memproses pengingat tertunda. Aktivasi browser tetap diperlukan
  untuk bunyi. Matikan/snooze/volume/mute dan deduplikasi per penerima tetap berlaku.
- Bagian **Tag peluang / sektor** di form Product Holding dihapus sesuai permintaan
  sebelumnya, tanpa menghapus nilai existing. Checklist holding/segmen tetap ada.
- File utama: `components/appointment-card-countdown.tsx`,
  `lib/appointment-card-clock.ts`, `app/(app)/work/page.tsx`,
  `lib/services/service-cases.ts`, notification-center/audio/settings,
  `tests/appointment-card-clock.test.ts`, tes integrasi dan harness browser.
  Tidak ada migration, reset database, perubahan akun atau aktivasi SMTP.
- Tes regresi: **99 lulus, 2 skip**, 20 file (workbook lama tidak tersedia).
  Typecheck, lint dan production build lulus. **64 pemeriksaan browser lulus**
  pada database test terisolasi: countdown kartu bergerak, simpan/perubahan status
  senyap meski preferensi lama aktif, worker → SSE → modal → alarm, snooze,
  deduplikasi dua tab, mute/volume, akses dan tampilan desktop/HP.
  Bunyi fisik speaker laptop/HP pengguna tetap perlu dicoba manual; pemeriksaan
  browser memverifikasi pemutaran Web Audio, bukan volume speaker perangkat.
- Guidebook diperbarui dari screenshot browser terbaru untuk Akuisisi Nasabah,
  tracking, form janji, modal alarm dan Product Holding (tanpa Tag peluang/sektor).
  PDF **33 halaman**, **8.733.361 byte**, berhasil dibaca/verifikasi gambar tertanam.
  Screenshot halaman lain berasal dari audit sebelumnya, bukan pemeriksaan ulang
  seluruh fitur pada perubahan countdown ini.

## Alarm dengan Matikan/snooze & Product Holding — pembaruan terbaru

Bagian ini menggantikan uraian bunyi satu putaran pada catatan historis:
**satu alarm per pengingat**, dengan satu sumber Web Audio looping maksimum
2 menit, bukan pengulangan job otomatis. Modal besar menampilkan waktu WIB,
kode/detail janji, lokasi, kendali dan next action. Matikan, X, Escape atau overlay
menghentikan bunyi serta menyimpan acknowledgment. Ingatkan lagi **1/5/10 menit**
menutup alarm dan membuat satu job baru pada outbox PostgreSQL per penerima;
tidak menggunakan timer browser sebagai scheduler. Volume/mute tetap berlaku.

- Kendali dan **semua pendamping yang dipilih** menerima slot pengingat masing-
  masing. Snooze/Matikan penerima A tidak mengubah pengingat penerima B. Dua tab
  berkompetisi atas claim POPUP atomik; hanya pemilik modal mengambil claim AUDIO.
  Tidak ada bunyi ulang otomatis akibat refresh/reconnect. Browser dapat kehilangan
  aktivasi audio setelah reload/navigasi penuh; modal menjelaskan dan menyediakan
  Bunyikan suara. Tidak memaksa izin, volume OS atau audio ketika tab/HP tidur.
- Route baru `GET/POST /api/notifications/[id]/alarm`: login, penerima, cabang,
  penugasan, versi/status janji serta same-origin/validasi server. Snooze melewati
  waktu janji ditolak. Lock case → notification, unique dedup key dan transaksi
  membuat klik ganda idempotent. Job lama dibatalkan saat reschedule/selesai/batal
  atau perubahan penugasan. Scheduler tetap 60 detik; snooze bukan detik-presisi.
- Migration additive **20261008140000_alarm_snooze** menambah dua timestamp
  nullable Notification (`alarmDismissedAt`, `snoozedUntil`). Sudah diterapkan
  dengan migrate deploy pada database lokal operasional dan dua database test;
  **19 migrations**, tanpa reset, penghapusan mapping atau perubahan akun.
- **Product Holding** menggantikan judul Discovery & peluang relevan. Checklist
  berkelompok/search, 38 pilihan termasuk Livin’/NOW/Merchant/Food/Sukha, KUM/KUR,
  CC, Kopra MCM/H2H/Portal/Partnership dan layanan bisnis. Kode MCM tetap
  `KOPRA_CASH_MANAGEMENT`, kompatibel dengan holding existing. Default belum
  diketahui; pilihan baru aktif setelah konfirmasi. Lainnya tersedia untuk varian
  belum tercantum. Penawaran/response tetap terpisah dan dibatasi whitelist server,
  bukan memperluas otorisasi produk atau menyimpulkan kelayakan dari sektor.
  Sumber nama publik resmi dicatat di `docs/appointment-reminders.md`; katalog
  internal/otorisasi cabang masih perlu persetujuan. Excel Mapping tetap 14 kolom.
- Holding memakai MappingDiscovery existing; audit kini mencatat before/after
  produk yang digunakan. Tidak ada CIF/rekening pada checklist/ekspor/email,
  database lead kedua, scraping, akun demo baru atau perubahan penugasan nyata.

File baru utama: `components/appointment-alarm-dialog.tsx`,
`lib/services/appointment-alarm.ts`, `app/api/notifications/[id]/alarm/route.ts`,
`prisma/migrations/20261008140000_alarm_snooze/migration.sql`,
`tests/product-holding.test.ts`. File diubah: schema Prisma, notification-center,
notification-audio, appointment-countdown, detail pekerjaan, worker publisher,
mapping-discovery (catalogue/schema/panel/service), harness browser dan PDF,
README serta panduan pengingat. Bagian historis di bawah tetap untuk jejak audit.

### Pemeriksaan terbaru

- `npm run typecheck`, `npm run lint`, `npm run build`: lulus.
- `npm test`: **87 lulus, 2 skip**, 19 file; dua workbook lama tidak tersedia.
  Termasuk semua pendamping, dua request snooze bersamaan, pilihan 1/5/10 menit,
  versi/reschedule/selesai membatalkan snooze, batas waktu, penolakan lintas
  penerima/cabang, timezone, dua worker/lease serta validasi holding/whitelist.
- Smoke Edge headless: **57 pemeriksaan lulus**, production build lokal dan
  database UI test terisolasi. Worker nyata → DB → SSE → satu modal/sumber audio
  pada dua tab; snooze 1 menit diproses kembali, sumber audio berhenti saat snooze,
  Matikan persisten, refresh tidak replay, mute/volume nol berlaku. Janji/form
  diperiksa pada 360/390/768/1440 px; modal alarm dan penyimpanan/muat holding
  MCM/H2H diperiksa desktop/390 px. `.artifacts/appointment-smoke/results.json`.
  Percobaan awal menemukan aktivasi audio hilang setelah navigasi penuh (pembatasan
  browser, kini diuji dengan gesture yang benar), dan fixture janji belum layak
  masuk daftar Mapping (harness kini membuat fixture Mapping lewat API terpisah).
  Tidak menonaktifkan batas akses atau autoplay untuk memaksakan kelulusan.
- Guidebook **33 halaman** memakai screenshot aktual baru untuk Akuisisi Nasabah,
  form janji, tracking, alarm dan Product Holding, desktop/HP. Screenshot halaman
  lain dipertahankan dari audit aktual sebelumnya; bukan klaim audit seluruh
  halaman diulang. PDF diperbarui dengan `scripts/audit-ui-guide.ts --refresh-final`.
  Alur audit historis juga disesuaikan ke companion/accept/takeover dan SSE umum,
  tetapi keseluruhan harness audit historis tidak dijalankan ulang pada pembaruan ini.
  `npx tsx scripts/verify-guidebook.ts` lulus: PDF terbaca 33 halaman, 10 screenshot
  desktop/HP baru tertanam pada halaman 21–30, bukan gambar kosong. Bukti:
  `.artifacts/appointment-smoke/guidebook-check.json`.
- SMTP tetap mati/dry-run, tidak mengirim email. Suara speaker nyata, Safari/iOS,
  laptop tidur, push ketika browser tertutup dan deployment internal belum terbukti.

Untuk menggunakan perubahan: deploy migration, generate Prisma, build, lalu
restart **web dan worker**. Development `npm run dev` menjalankan keduanya.
Konfigurasi/privasi existing dipertahankan; tidak ada credential baru atau reset DB.

## Tracking janji dan titik KCP — pembaruan lanjutan 8 Oktober 2026

- `lib/branch-location.ts` memakai `-6.14621,106.82421` dan alamat RT.6/RW.7
  sesuai konfirmasi pengguna/pengelola. `.env` lokal privat memuat tiga
  `APPOINTMENT_BRANCH_*` dengan timestamp konfirmasi; bukan klaim survei bank.
  SMTP tetap `EMAIL_ENABLED=false`, `SMTP_DRY_RUN=true`. Restart web dan worker
  diperlukan; proses development milik pengguna tidak dihentikan oleh pengujian.
- Janji akuisisi (`sourceSystem=MABES_LINK`) tidak menjadwalkan alarm sebelum
  penerimaan. PATCH `/api/service-cases/[id]` status ACCEPTED mengonfirmasi waktu
  tercatat secara atomik, mencatat penerima/audit dan baru membuat slot mendatang.
  Waktu kosong/lewat ditolak. Dialog penerimaan menjelaskan konfirmasi ini;
  kebutuhan membuat janji masih boleh dicatat eksplisit tanpa waktu.
- Form janji baru memilih Terkonfirmasi sebagai default dan mewajibkan waktu WIB.
  Data existing tidak dikonfirmasi massal atau diubah penanggung jawabnya.
  Worker dan endpoint klaim menolak alarm pra-penerimaan; rekonsiliasi startup
  membatalkan job versi lama yang belum diterima, termasuk job V2.
- `components/appointment-countdown.tsx` menampilkan countdown janji dan
  pengingat berikutnya dari outbox PostgreSQL versi/recipient aktif, termasuk
  status terjadwal/diproses/notifikasi dibuat/batal/gagal. Angka setiap detik;
  refresh status server setiap 15 detik. Tidak memutar suara dari timer dan tidak
  membuat scheduler kedua. Worker 60 detik dan SSE 2 detik tetap terpisah.
- Detail janji menampilkan Tracking janji dan Kelola janji dalam sidebar yang
  rapi. Readiness layanan/penggunaan tidak ditampilkan untuk janji akuisisi.
  Janji terlaksana hanya mengubah AppointmentStatus, menghentikan reminder dan
  mengecualikan janji terminal dari overdue/digest; tidak mengubah HANDLED atau
  membuat UsageVerification. Kasus layanan existing tetap memiliki alur/readiness.
- Uji browser sempat menemukan panel countdown ganda setelah refresh penerimaan:
  dua sibling memakai key React sama. Key countdown/actions kini terpisah dan
  harness memeriksa hanya satu panel terlihat setelah penerimaan.
- Diagnosis read-only setelah konfigurasi: 117 mapping, 2 akun, 0 janji
  terkonfirmasi, 2 job pending; heartbeat worker aktif dan titik KCP dikenali.
  Akun, database dan mapping operasional tidak di-reset/diubah oleh pengujian.
- Hasil aktual: `npm run typecheck`, `npm run lint`, dan production
  `npm run build` lulus setelah perbaikan key. `npm test`: **79 lulus, 2 skip**
  (dua fixture workbook lama tidak tersedia), 18 file. Smoke Edge headless:
  **45 pemeriksaan lulus**, termasuk klik Terima pekerjaan, countdown bergerak,
  panel tidak ganda, worker → PostgreSQL → SSE → pop-up, ringtone unggahan satu
  putaran di dua tab, refresh/reconnect tanpa ulang, mute/volume dan akses CS
  bukan penerima ditolak. Detail dan form diperiksa pada 360/390/768/1440 px.
  Screenshot aktual diperiksa pada desktop dan 390 px; bukti sintetis lokal:
  `.artifacts/appointment-smoke/results.json`, `appointment-tracking.png`,
  `tracking-{360,390,768,1440}.png`, dan `notification-desktop.png`.
  Dua percobaan awal smoke gagal karena panel ganda dan memicu perbaikan nyata;
  rerun lengkap terakhir lulus. Pemutaran Web Audio terbukti, bukan audibilitas
  speaker fisik, Safari/Opera, HP terkunci atau background push. SMTP tidak dikirim.

File utama tambahan/perubahan: `components/appointment-countdown.tsx`,
`app/(app)/work/[id]/page.tsx`, `components/service-case-actions.tsx`,
`components/service-case-form.tsx`, `lib/branch-location.ts`,
`lib/services/service-cases.ts`, `lib/services/notifications.ts`,
`lib/services/dashboard.ts`, `lib/notifications.ts`,
`tests/appointment-reminders.integration.test.ts`,
`tests/operational.integration.test.ts`, `scripts/appointment-browser-smoke.ts`,
`docs/appointment-reminders.md`, README dan `.env` lokal privat (tidak di-commit).
Tidak memerlukan migration tambahan untuk perubahan lanjutan ini.

## Perbaikan janji, pengingat dan alarm — 8 Oktober 2026

Bagian ini menggantikan aturan alarm T−30…T0/pengulangan 5 menit pada catatan
historis di bawah. Arsitektur dan data operasional tetap dipertahankan.

### Temuan dan perubahan

- Scheduler lama membuat tujuh job per penerima; pemilik janji dipilih dari PIC
  pertama, bukan selalu pembuat. UI juga memisahkan waktu tindak lanjut dan janji.
  Form kini hanya **Waktu janji (WIB)**, wajib saat dikonfirmasi. Jadwal tentatif
  tidak mengaktifkan pengingat. Kendali otomatis pembuat; anggota pendamping
  CS/OUTBRANCH cabang sama opsional dan dapat mengambil alih eksplisit/teraudit.
  Pemilik kasus existing tidak ditulis ulang, akun tidak diubah.
- `lib/appointment-reminders.ts`: T−24 jam ditambah T−15 menit untuk jarak
  terverifikasi ≤1 km, T−1 jam untuk >1 km; lokasi/KCP tidak terverifikasi fallback
  T−1 jam dengan alasan. Koordinat 0 sah. Jarak Haversine bukan waktu tempuh/rute.
  Titik KCP hanya memakai tiga variabel `APPOINTMENT_BRANCH_*` server yang
  dikonfirmasi pengelola; default kosong, bukan menganggap pin publik sebagai
  terverifikasi. Perubahan pin melepaskan konfirmasi verifikasi pada form.
- Tidak membuat slot terlewat atau alarm T0. Toleransi dispatch 90 detik (tick
  worker 60 detik + jitter); setelah itu batal, termasuk sesudah restart/lease
  recovery. Reschedule/kendali/status selesai/batal membatalkan versi lama.
  Janji tanpa waktu tidak masuk overdue hanya karena tenggat teknis non-null.
- Worker terpisah mempertahankan SKIP LOCKED, lease, dedup dan retry existing.
  Rekonsiliasi startup job legacy dipaginasi; dua worker menggunakan row lock dan
  cek ulang dedup versi. Publikasi notifikasi dikunci bersama ServiceCase dan
  versinya dicek lagi sebelum SMTP, tanpa menahan transaksi selama SMTP.
- Endpoint baru POST `/api/notifications/[id]/claim` dengan channel AUDIO/POPUP:
  memeriksa auth, penerima/cabang, ruang data, status/versi/expiry; update atomik
  timestamp receipt mencegah pengulangan refresh/reconnect/tab/perangkat lain.
  At-most-once attempt, bukan jaminan audibilitas jika tab/browser mati sesudah
  claim. Ringtone pengingat memainkan satu putaran; pengulangan pengaturan hanya
  untuk perubahan umum. Bug label mute antar-tab ditemukan dan diperbaiki.
- Detail pekerjaan dan peta janji membedakan kendali dari pendamping. Pengaturan
  ADMIN menjelaskan menit reminder umum tidak mengubah kebijakan janji tersebut.
  Status izin, aktivasi, mute, volume dan tes tetap tersedia tanpa izin paksa.
- Email internal menggunakan waktu janji WIB/kode/link, bukan identitas nasabah.
  SMTP nyata tidak dikirim dalam pengujian ini.

### Schema, konfigurasi dan pemeriksaan aktual

- Migration additive `20261008110000_appointment_reminder_receipts`:
  `Prospect.locationVerifiedAt` dan `Notification.popupClaimedAt`,
  `audioClaimedAt`, `reminderExpiresAt`, semuanya nullable timestamptz.
  `db:deploy` memverifikasi 18 migrations dan tidak ada pending migration pada
  database lokal. Tidak reset/reseed/drop data atau mengubah akun.
- Diagnosis read-only lokal: 117 mapping, 2 akun operasional, 0 janji terkonfirmasi,
  worker heartbeat aktif. `EMAIL_ENABLED=false`, `SMTP_DRY_RUN=true`, SMTP belum
  lengkap dan titik KCP belum dikonfirmasi melalui environment. Konfigurasi ini
  menjelaskan mengapa email nyata belum terkirim; status/audio Chrome pengguna
  tidak dapat dibaca dari server dan tidak diasumsikan.
- Tes regresi: **78 lulus, 2 dilewati**, 18 file. Dua skip tetap fixture workbook
  lama yang tidak tersedia. Sembilan tes baru membuktikan WIB, cutoff 1 km,
  fallback, terlalu dekat/lewat, validasi, akses, takeover, pembatalan, dua worker,
  receipt konkuren, restart/lease tanpa pengingat terlambat, dan tenggat kasus
  legacy bersumber null tetap terhitung tanpa membuat janji kosong overdue.
- Browser Edge headless pada production build/database samaran terpisah:
  **35 pemeriksaan lulus** untuk HTTP create → worker terpisah → notifikasi
  PostgreSQL → SSE/pop-up → Web Audio ringtone unggahan, dua tab/refresh,
  mute/volume dan denial CS nonpenerima. Form 360/390/768/1440 px memiliki satu
  waktu wajib hanya saat dikonfirmasi dan tidak overflow horizontal.
  Screenshot modal aktif setelah paint sudah diperiksa. Sisa validasi tombol
  simpan yang mensyaratkan pin/pendamping ditemukan lalu dihapus; uji simpan form
  tanpa keduanya juga lulus melalui HTTP 201 dari form aktual. Hasil paling
  akhir ada di `.artifacts/appointment-smoke/results.json`.
- `typecheck`, `lint`, production `build` dijalankan dan lulus; pemeriksaan akhir
  dilakukan lagi setelah penyelarasan label peta. Pengujian terisolasi tidak
  menggunakan akun operasional, tidak mengirim SMTP, dan membersihkan fixture
  miliknya. Smoke lama diganti harness alur nyata, bukan klaim lima putaran.

File utama: `lib/appointment-reminders.ts`, `lib/notifications.ts`,
`lib/services/service-cases.ts`, `lib/services/notifications.ts`,
`components/service-case-{form,actions}.tsx`, `components/notification-{center,audio-settings}.tsx`,
`app/(app)/work`, komponen peta janji, migration/schema, `worker/index.ts`,
dua file tes `appointment-reminders*`, `scripts/appointment-browser-smoke.ts`,
`scripts/check-reminder-runtime.ts`, `.env*.example` dan README.

Panduan lengkap: [docs/appointment-reminders.md](./docs/appointment-reminders.md).
Jalankan migration/generate/build lalu restart web dan worker terpisah; alternatif
development `npm run dev`. Diagnosis aman `npm run diagnose:reminders`.
Keterbatasan: speaker fisik, HP terkunci/tab tidur, Safari/iOS/Opera dan pengiriman
SMTP/inbox organisasi **belum dibuktikan**. Tidak ada background Web Push, izin
browser paksa, koordinat rekaan atau integrasi CAKRA/core banking baru. PDF audit
sebelumnya tetap artefak audit sebelumnya, bukan bukti visual kebijakan janji baru.

## Audit kode, UX, regresi dan guidebook — 8 Oktober 2026

### Cakupan dan data

- Membaca dokumentasi, schema/migration, auth Better Auth, RBAC, komponen peta,
  form/modal, QRIS, outbox/worker dan instruksi Next.js lokal sebelum perubahan.
- Tidak reset, seed ulang, impor workbook, mengubah akun operasional, menonaktifkan
  izin, atau deploy publik. Pembacaan akhir database lokal: **117 mapping dan 2
  akun operasional**, sama dengan inventaris awal. Tidak mengubah `.env` berisi
  secret atau menebak Google/SMTP key. Tidak ada migration/schema baru.
- **Catatan baseline:** runner tes existing awalnya mewarisi tujuan operasional
  dari environment lokal dan sempat membuat fixture sementara di DB tersebut;
  cleanup suite menghapus fixture. Ini diperbaiki: Vitest kini memaksa database
  `mabeslink_test` dan SMTP nonaktif/dry-run. Seluruh rerun regresi setelah perbaikan
  memakai DB test. UI/HTTP memakai DB baru `mabeslink_ui_test_20261008` berisi hanya
  data samaran, dimigrasi terpisah dengan 17 migration existing; bukan reset DB asli.
  Fixture UI guidebook sengaja tetap di DB test agar dapat diinspeksi.
- Model `Prospect`, referensi CAKRA opsional, ServiceCase, FollowUp, Handover,
  MappingDiscovery/Opportunity dan UsageVerification tetap sumber data existing.
  Tidak membuat master lead/lokasi kedua atau integrasi CAKRA. Persetujuan pemilik
  proses untuk tumpang tindih akuisisi/kunjungan/reminder masih belum tersedia.

### Perbaikan yang diimplementasikan

- `components/ui/search-combobox.tsx`: ikon/placeholder stabil, dropdown saran,
  keyboard Arrow/Enter/Escape, clear, loading/empty/error dan accessible combobox.
  Debounce tetap di pemilik input: produk 220 ms, referensi lokasi 260 ms,
  Mapping 280 ms, alamat QRIS 500 ms. Request alamat lama di-abort/diabaikan.
  Dropdown alamat QRIS membuka ke atas agar tidak tertutup tombol pada HP.
- `components/ui/info-tooltip.tsx`: informasi field/status/heatmap/audio bisa
  hover, fokus keyboard, klik/sentuhan, Escape dan klik luar. Label Latitude,
  status janji dan pengulangan alarm terhubung eksplisit ke input, bukan ke ikon.
- Mapping: file input foto tidak lagi membuat overflow pada 360 px; pencarian,
  filter, clipboard, penghapusan foto dan error menggunakan feedback konsisten.
  Heatmap otomatis memfokuskan titik hasil filter; diuji bukan sekadar canvas ada,
  melainkan pixel alpha berisi pada canvas. Peta tetap dominan, daftar bounded,
  full-map toggle, batas dan titik cabang existing; reduced-motion berlaku pada
  gerakan fly/fit Leaflet. Tidak mengubah koordinat/sumber verifikasi operasional.
- `components/app-nav.tsx`: navigasi HP menjadi empat tujuan utama + **Lainnya**,
  bukan deretan menu panjang. Menu kerja memakai dialog yang bisa Escape,
  berisi tujuan sesuai izin, informasi role/cakupan dan logout berkonfirmasi.
- `components/ui/dialog.tsx`: stack modal, hanya dialog paling atas menerima
  Escape/Tab; modal induk inert selama konfirmasi; scroll lock bertahan hingga
  dialog terakhir ditutup. Fokus dipulihkan dan klik dalam tidak menutup modal.
  Form dirty tetap meminta konfirmasi; cancel Mapping tidak melewati pengaman.
  Konfirmasi penting memfokuskan Batal dahulu, bukan aksi berbahaya.
- Form janji: dropdown **Perlu membuat janji / Menunggu konfirmasi /
  Terkonfirmasi**. UI default perlu membuat janji; waktu follow-up tidak otomatis
  menjadi appointmentAt terkonfirmasi. API lama tanpa field baru mempertahankan
  default CONFIRMED untuk kompatibilitas; perubahan UI mengirim status eksplisit.
  Tidak memodifikasi status/jadwal record existing.
- Alarm/notifikasi: klaim audio memakai Web Locks + localStorage untuk mencegah
  race dua tab; fallback storage terblokir bersifat best effort per tab, bukan
  janji exactly-once lintas browser. Semua tab tetap menerima daftar SSE, hanya
  satu toast/claim audio per notifikasi. Volume nol/mute/disable menghentikan sumber
  yang sedang/sudah dijadwalkan; OS notification tidak menahan audio karena
  service worker belum aktif. Aktivasi tidak reentrant; audio/ringtone dibersihkan
  saat unmount. Izin browser tidak dipaksa; alarm browser tertutup tetap tidak dijamin.
- SSE: validasi cursor signed-bigint, cursor 0 ascending, 401 tanpa sesi, 422
  cursor invalid, revalidasi sesi/role/cabang setiap poll. Mark-read memakai scope
  penerima/cabang/isTest yang sama. Poll fallback serialized dan menangani reconnect.
  SSE default 2 detik; polling cadangan 5 detik; scheduler worker tetap 60 detik.
- `proxy.ts` + `lib/request-origin.ts`: semua mutasi Route Handler API memeriksa
  origin/Sec-Fetch-Site; auth tetap memakai proteksi Better Auth. RBAC di service
  tidak dihapus. Logger Prisma raw payload dimatikan; API/worker mencatat kategori
  error, bukan query/mutation berisi identitas atau secret.
- Worker tidak menjalankan dua tick tumpang tindih dalam satu proses; shutdown
  menunggu tick aktif. Lock/lease/outbox/dedup dan transaksi existing dipertahankan.
- Carousel banner unggahan mempunyai kontrol jeda, target sentuh dan pause pada
  hover/fokus. Home navy-gold/reveal/brand/FAQ existing dipertahankan dan diperiksa.
- QRIS: template lokal Batik/Alam, area kode/logo terkunci, form opsional, unggah,
  render dan download diperiksa lewat API nyata. Tidak membuat QR pembayaran baru,
  memalsukan merchant, atau mengklaim akrilik gratis. QR uji bukan kode pembayaran.

### Arsitektur dan build server

- Stack tidak berubah: Next.js **16.3.8**, React **19.2.8**, TypeScript 5,
  Prisma/adapter-pg **7.10.0**, PostgreSQL **16**, Better Auth **1.7.7**, Zod **4.6.5**,
  Leaflet **1.9.4**, Nodemailer **10.0.13**. Lockfile existing dipertahankan.
- FE dan BE adalah satu web Next.js (UI + Route Handlers), bukan dua backend.
  Worker Node terpisah membaca outbox PostgreSQL; file privat pada volume persisten.
- `Dockerfile`: urutan npm ci/Prisma benar, build tanpa secret runtime, dependency
  cache, runtime non-root, private storage, binding internal container 0.0.0.0.
  Workbook nyata, dump/arsip, environment dan private data dikecualikan dari image.
- `docker-compose.yml`: postgres/migrate/web/worker, bridge network, health,
  depends-on, restart policy, volume database existing + private uploads, publikasi
  loopback saja. Database tidak direcreate saat audit. `scripts/compose-local.ts`
  derive config hanya dari DSN lokal valid tanpa menulis/mencetak secret; menolak
  kredensial POSTGRES_* berbeda. `compose:check` berhasil terhadap environment existing.
- Compose production tetap memakai env file server, tidak membuka port DB dan web
  hanya loopback. Reverse proxy HTTPS internal, firewall, observability, secret
  manager, retensi dan approval organisasi bukan sesuatu yang dibuktikan oleh build.
  Restart policy menangani proses keluar, **bukan otomatis me-restart setiap status
  unhealthy**; health stale tetap memerlukan monitoring/alert hosting.
- Backup/restore PowerShell memakai env file eksplisit, memeriksa exit code,
  tidak menimpa backup host lama; pg_restore single-transaction/exit-on-error.
  Panduan mencakup DB dan file privat, maintenance window dan verifikasi akses.
  Skrip hanya diperiksa sintaks; **tidak melakukan restore/drill pada database asli**.

### Hasil aktual

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | Lulus |
| `npm run lint` | Lulus |
| `npm test` | 16 file, **69 lulus / 2 skipped**; dua fixture workbook 42 baris lama tidak tersedia |
| `npm run build` | Lulus, production build Next.js termasuk Route Handlers/proxy |
| `test:audit-ui` | **54 checks**, **54 screenshot**; 10 halaman utama pada 360/390/768/1440 px, Home/login, tambahan admin/pendaftar QRIS (desktop/HP), detail pekerjaan/handover/referensi; HTTP nyata dan pembatasan empat role |
| SSE dua tab | Notifikasi baru diterima sekitar **1,7–2 detik** (rerun terakhir 1.967 ms), dropdown kedua tab terisi, hanya satu toast global |
| Alur HTTP nyata | Janji belum terkonfirmasi → konfirmasi/reschedule membatalkan versi lama → CS mengakui/proses/selesai → verifikasi/tutup → handover diterima/siap → penggunaan terpisah |
| `test:visual` | Lulus empat ukuran; form invalid/ikon/koordinat, modal fokus/Escape/overlay/dirty, kontrol volume 0/50/100, mute, custom WAV. Satu submit janji di-intercept untuk uji payload; bukan bukti persistence |
| `test:home-visual` | Lulus 360/390/768/1440 px, animasi/reveal/carousel dan aset; tanpa overflow/gambar rusak/pageerror |
| `test:qris-visual` | Lulus empat ukuran; API unggah QR samaran, pilih Alam, preview, unduh PNG signature valid, hapus sesi |
| `scripts/qris-api-smoke.ts` | Batik Nusantara, Alam Indonesia, Signature: **6 respons HTTP 200**, signature PNG/PDF valid; consent kontak false, sesi dibersihkan |
| `docker build -t mabeslink:audit-20261008 .` | Image berhasil dibangun; FE/BE/worker dalam image yang sama |
| Docker runtime | HTTP di **dalam container** lulus: health DB/worker, API internal tanpa login 401, Home/login/QRIS/kedua template 200; restart web/worker dan database/volume privat bertahan |
| Port Docker dari host | **Lulus**: health HTTP dapat diakses pada loopback 3101. Kegagalan smoke awal berasal dari pemanggilan `Response.ok` sebagai fungsi di skrip, sudah diperbaiki dan diulang; bukan kegagalan jaringan aplikasi |

Tes regresi mencakup akses lintas PIC/cabang, handover oleh penerima, status valid,
siap bukan penggunaan, dua client worker mengklaim satu job, lease/restart client,
reschedule/reassign/complete, timezone WIB, SSE/query/mark-read, SMTP dry-run/kuota/
failed, koordinat 0/batas/pasangan, URL Google Maps/Haversine, gambar privat,
discovery/screening/manual checklist dan Excel 14 kolom. Uji restart Docker nyata
melengkapi uji restart client, tetapi bukan bukti DR restore atau failover DB.
Tidak mengirim SMTP eksternal; accepted/inbox **belum diuji**. Unit/Chromium headless
memeriksa kontrol audio dan sumber suara, bukan membuktikan speaker laptop/HP
berbunyi. Chrome/Opera/Safari/iOS dan OS notification pada perangkat nyata belum diuji.
Geocoder/Google iframe tanpa konfigurasi valid tetap fallback jujur, bukan integrasi
Google Places yang berhasil. Peta OSM aktual dan Google Maps URLs tetap tersedia.
Container PostgreSQL existing masih memakai publikasi legacy port 5434 pada semua
interface; konfigurasi Compose baru membatasi loopback tetapi audit tidak merecreate
container/DB. Batasi firewall atau lakukan perubahan binding terjadwal oleh pengelola.

### File dan cara menjalankan

- Komponen: `components/ui/{search-combobox,info-tooltip,dialog,feedback}.tsx`,
  `components/{mapping-workspace,mapping-map,service-case-form,app-nav,
  notification-center,notification-audio-settings,qris-custom-editor,
  home-banner-carousel}.tsx`, `app/globals.css`.
- Server: `lib/{db,session,api,validation,request-origin,notification-cursor}.ts`,
  `lib/client/notification-audio.ts`, `lib/services/{notifications,service-cases}.ts`,
  `app/api/notifications/**`, `proxy.ts`, `worker/index.ts`.
- Build/ops: Dockerfile, dua Compose, env examples, `scripts/compose-local.ts`,
  `lib/local-compose-env.ts`, backup/restore, test server, Vitest config dan tests.
- Bukti: `.artifacts/audit-ui/results.json`, `docker-runtime.json`, PNG screenshot
  dan output QR uji; semuanya lokal/diabaikan Git. Panduan PDF samaran **27 halaman**
  telah dibaca dan empat halaman dirender/diperiksa (cover, screenshot, output QRIS,
  panduan akhir), memakai font TTF tertanam agar tidak bergantung pada substitusi
  font viewer. Tautan:
  [MABES_LINK_Guidebook_2026-10-08.pdf](./docs/MABES_LINK_Guidebook_2026-10-08.pdf).
- Existing lokal: `npm ci`, `npm run compose:check`, DB existing aktif,
  `npm run db:deploy` (migration aman; jangan reset), `npm run build`, lalu
  `npm start` + `npm run worker` pada terminal terpisah. Atau `npm run dev`.
  `npm run compose:up` hanya setelah port 3000 bebas dan backup/konfigurasi verified.
  Production internal mengikuti README dan `docker-compose.production.yml`.
- Guidebook: start web pada DB UI test menggunakan `start:test`, kemudian
  `test:audit-ui`; QR render tambahan melalui `scripts/qris-api-smoke.ts`.
  `npx tsx scripts/audit-ui-guide.ts --pdf-only` hanya membaca hasil audit lengkap
  dan membangun ulang PDF tanpa membuat akun/fixture baru.

### Belum terbukti / tindak lanjut hosting

Jangan menyatakan siap produksi: perlu approval data/CAKRA, katalog produk,
otorisasi integrasi, uji browser/perangkat dan audibilitas nyata, izin notifikasi,
SMTP organisasi/inbox, akses HTTPS internal dan jaringan hosting tujuan,
DR backup+restore terenkripsi, kapasitas/load test, monitoring dan review keamanan.
Tidak ada chatbot, WhatsApp blast, API AI, scraping, bypass OTP/biometrik, kredit
otomatis atau koneksi nyata core banking pada perubahan ini. Biaya worker selalu
hidup, web, PostgreSQL, private storage dan backup terpisah dari kuota SMTP.

## Riwayat sebelum audit 8 Oktober

Bagian berikut adalah catatan historis; hasil terbaru di atas menggantikan
keterangan "tanpa testing" pada pembaruan visual 7 Oktober.

## Pembaruan peta lebar dan Home (tanpa eksekusi tes)

- Penyempurnaan banner: dekorasi lingkaran diganti pita kuning berupa SVG,
  opacity 10%, tiga gelombang besar membentang dari ujung kiri ke kanan banner.
  Dekorasi berada pada z-0/noninteraktif, teks/gambar/kontrol pada z-10. Teks, gambar, dan kontrol
  berada pada layer di atas dekorasi. Tidak menjalankan tes/build untuk perubahan
  visual ini, mengikuti permintaan pengguna sebelumnya.

- `lib/mandiri-promotions.ts` dan carousel: pengenalan Livin’, Kopra, Livin’ Merchant,
  simpanan, pinjaman, kartu, investasi/asuransi, bisnis dan Prioritas. Kelompok
  dipilih melalui chip horizontal responsif, dengan penghitung slide dan tautan
  jelajahi seluruh produk ke katalog/sitemap resmi; bukan klaim katalog lengkap
  tersalin di aplikasi atau promo diskon untuk semua produk. Konten mengarah ke
  [Livin’](https://www.bankmandiri.co.id/en/livin),
  [Kopra](https://www.bankmandiri.co.id/en/kopra-better-experience), dan halaman
  kelompok produk dalam [sitemap resmi](https://www.bankmandiri.co.id/site-map)
  yang diperiksa 7 Oktober 2026. Tidak mengubah izin penawaran/approval internal.
  Build/tes/visual untuk penyempurnaan ini tidak dijalankan.

- Logo banner dipusatkan pada `promotionBrands` di `lib/mandiri-promotions.ts`
  bersama alt text masing-masing: Livin’/Simpanan menggunakan
  `Livin 01-Master Brand Logo.png` sesuai permintaan pengelola, Kopra menggunakan
  logo Kopra, dan Merchant menggunakan Livin’ Merchant. Pinjaman, kartu,
  investasi, Prioritas, serta kelompok Bisnis umum memakai logo induk
  Mandiri karena tidak tersedia aset khusus kategori tersebut. Logo Kopra tidak
  lagi mewakili seluruh simpanan/pinjaman bisnis. Mockup QRIS tetap dipertahankan.
  Tidak mengubah file gambar/logo asli; build/tes tidak dijalankan.

- Banner Asuransi dipisah dari Investasi dan memakai aset lokal
  `public/Gambar/AXA_Mandiri_2016.svg`, alt text AXA Mandiri, object-contain,
  serta SVG direct/unoptimized tanpa mengaktifkan dangerouslyAllowSVG global.
  CTA menuju [situs resmi AXA Mandiri](https://www.axa-mandiri.co.id/) yang dibaca
  7 Oktober 2026; manfaat/premi/pengecualian/klaim mengikuti polis, bukan janji
  MABES LINK. Investasi tetap logo Mandiri dan tidak mencampurkan asuransi AXA
  dengan reksa dana/SBN. File SVG asli tidak diubah. Tes/build tidak dijalankan.

- `components/mapping-workspace.tsx`: peta menjadi kolom dominan dengan panel
  daftar 290–310 px di desktop, daftar bounded-scroll/sticky, kartu ringkas,
  tombol Perbesar peta/Tampilkan daftar, serta pengaturan visual dalam accordion.
  Pada HP peta setinggi 520 px dan daftar dibatasi 420 px.
- `components/mapping-map.tsx`: pusat awal/marker logo Mandiri, tombol fokus
  cabang terpisah dari referensi batas kelurahan, fokus saat memilih kartu, dan
  ResizeObserver untuk invalidateSize setelah perubahan layout. Heatmap dipindah
  ke pane Leaflet noninteraktif di bawah marker/popup, redraw pada move/resize/
  zoomend/viewreset, zoom animation hide, gradasi warna halus, dan alpha tepi
  dibersihkan. Heatmap tetap kepadatan titik, bukan skor kredit/potensi dana.
- `lib/branch-location.ts`: titik `-6.1471567,106.8235563` dan Google listing CID
  dari [direktori publik](https://id.near-place.com/bank-mandiri-komp-thr-lokasari-blok-b-no-1-2-3-4-5-7-jl-mangga-besar-raya-no-81-tangki-tamansari-rt6rw2-tangki).
  Alamat cabang ditemukan juga pada [daftar CSM resmi Mandiri](https://www.bankmandiri.co.id/en/customer-service-machine-bank-mandiri/lokasi-csm).
  Titik direktori belum merupakan validasi pengelola/survei; tidak mengubah
  koordinat atau status verifikasi 117 mapping existing.
- `app/page.tsx`, `components/scroll-reveal.tsx`, `app/globals.css`: fade/slide
  berdasarkan IntersectionObserver, ilustrasi floating, reduced-motion fallback,
  konten tetap terlihat tanpa JavaScript, dan gaya navy-gold responsif.
- `components/home-promotion-carousel.tsx`: informasi QRIS Custom/Livin’ Merchant,
  prev/next/pilihan kelompok/jeda serta pause pada hover/fokus. Banner informasi HUT ke-28
  hanya Oktober 2026 dan menautkan [halaman resmi](https://www.bankmandiri.co.id/en/hut-mandiri-28).
  Aset lokal dipakai; tidak mengunduh iklan/menambahkan klaim promo tertentu.
  Carousel banner unggahan petugas tetap dipertahankan.
- `components/home-location-map.tsx`, `components/branch-map.tsx`: frame lokasi
  dengan tautan rating/ulasan Google. Google iframe memakai `GOOGLE_MAPS_EMBED_URL`
  dari fitur Bagikan/Sematkan (hostname/path/protocol divalidasi) atau key Embed
  API existing. Tanpa konfigurasi valid, Leaflet cabang tampil sebagai alternatif
  yang diberi label berbeda. Angka rating belum terverifikasi dan tidak dibuat.
  `.env.example`, `.env.production.example`, README diperbarui; tidak mengisi key
  palsu atau mengubah environment berisi rahasia.
- Tidak ada migrasi, seed, reset, perubahan akun/data/izin, atau deployment.
  **Build, typecheck, lint, tes dan smoke/visual browser tidak dijalankan untuk
  perubahan ini sesuai permintaan pengguna.** Hasil lulus pada bagian historis
  di bawah berlaku sebelum pembaruan ini. Geser/zoom/resize heatmap, mode peta
  lebar, desktop/HP, animasi scroll, navigasi carousel dan iframe Google tetap
  perlu diuji pengguna di lingkungan yang diizinkan.

## Pembaruan workbook Mapping 117 baris

- Workbook `MABES_LINK_Mapping_Mangga_Besar_2026-10-07.xlsx` (SHA-256
  `d7bbe8fe2786e5e67238f97a37b0a925c8360d6b41113ed4720b23ffdc8b3243`)
  dibaca tanpa mengubah file asli. Sheet `Mapping` memuat 117 baris valid,
  117 kode internal unik, 117 pasangan koordinat valid, 15 sektor, tanpa
  duplikat nama+alamat di workbook. Sheet pendamping menyebut 100 koordinat
  belum dicocokkan ke pin Google Maps; 17 lainnya merujuk sumber publik yang
  tetap memerlukan pemeriksaan titik. Sheet kontak, omzet, dan CIF diabaikan.
- Parser `lib/mapping-xlsx-reader.ts` menerima SpreadsheetML berprefiks `x:`
  melalui normalisasi dalam memori. Seeder CLI lama untuk workbook 42 baris
  dihapus dan diganti `scripts/seed-mapping-2026.ts` dengan mode pratinjau,
  hash tetap, pemeriksaan duplikasi/PIC/relasi, transaksi serializable, audit,
  dan no-op bila seed yang sama sudah ada. Koordinat disimpan sebagai
  `WORKBOOK_UNVERIFIED`; kebutuhan dan penggunaan tidak dikonfirmasi otomatis.
  Impor UI Excel juga memberi label belum diverifikasi pada koordinatnya.
- Pratinjau terhadap DB lokal: 42 prospek existing, **0** kode workbook yang
  sama, **35** nama yang cocok, satu PIC workbook cocok dengan akun aktif.
  Setelah pengguna menegaskan **hanya data Mapping** yang boleh diganti,
  backup baru `.data/backups/before-replace-only-mapping-20261007-145332.dump`
  dibuat dan daftar 252 entri `pg_restore` terbaca. Perintah
  `npm run mapping:seed-replace-prior` berhasil dalam satu transaksi: 42
  prospek Mapping lama tanpa pekerjaan terkait diganti oleh 117 prospek baru.
  Tidak ada reset database penuh, pembuatan akun, atau perubahan role/password.
  Verifikasi proses terpisah: 2 user, 2 account, 117 prospek, 117 discovery,
  117 terlihat oleh OUTBRANCH, 0 ServiceCase, 0 FollowUp, 0 UsageVerification,
  dan tepat 1 audit seed baru. Pratinjau ulang mengenali seed yang sama dan
  tidak membuat duplikat. File upload privat lama tidak dihapus; backup dapat
  dipakai untuk pemulihan bila diperlukan. Setelah penggantian,
  `npm run typecheck`, `npm run lint`, `npm test` (12 file/59 lulus, 2 dilewati),
  dan `npm run build` dijalankan ulang dan lulus. Tes visual desktop/HP dalam
  bagian ini berasal dari pemeriksaan kode sebelum commit data; ketepatan
  koordinat lapangan belum dibuktikan.
- UI `/mapping` mendapat pencarian lebih luas, ringkasan hasil/area/pin,
  filter cepat dan panel filter lanjutan; pin workbook ditandai perlu
  verifikasi. Beranda mendapat hierarki CTA dan navigasi mobile/desktop yang
  lebih rapi. QRIS Batik Nusantara dan Alam Indonesia ada di path yang dirujuk
  dan masing-masing 1064×1478 px.
- `.env` lokal mempunyai konfigurasi tile OSM dan URL aplikasi; `.env.local`
  belum ada. `GOOGLE_MAPS_EMBED_KEY` dan `LOCATION_SEARCH_URL` belum tersedia,
  jadi tidak diisi/ditebak. Google Maps URL tanpa key tetap berfungsi;
  iframe Embed memerlukan key, billing, dan pembatasan HTTP referrer.
- Pemeriksaan aktual: `npm run mapping:seed-preview` lulus tanpa menulis data;
  `npm run typecheck` lulus; `npm run lint` lulus; `npm test` pada database
  `mabeslink_test` lulus **12 file / 59 tes, 2 dilewati**; `npm run build`
  lulus; `npm run test:visual` lulus pada 1440/768/390/360 px setelah
  migration `HomeBanner` diterapkan **hanya ke database testing**;
  `npm run test:home-visual` lulus 1440/390 px tanpa gambar rusak/overflow;
  `npm run test:qris-visual` lulus 1440/768/390/360 px. Tes awal visual gagal
  karena tabel `HomeBanner` belum ada di DB testing dan label UI lama pada
  skrip tes; setelah migrasi/penyesuaian tes, tes ulang lulus. Integrasi
  Google Maps Embed dengan key nyata dan ketepatan 117 pin belum diverifikasi.

## Riwayat reset lokal sebelum penggantian Mapping 117 baris

- Pengguna menyetujui penghapusan **seluruh database lokal** dan pembuatan seed baru.
  Backup PostgreSQL dibuat dan daftar isinya diperiksa di
  `.data/backups/before-full-reset-2026-10-07-aa43a71cb3e3494e9f271304780e42a2.dump`.
  `prisma migrate reset --force` berhasil pada `localhost:5434/mabeslink`; 17
  migration, termasuk `20261007120000_home_banners`, diterapkan ulang. Ini
  menggantikan status historis di bawah yang menyebut database tidak di-reset.
- `npm run seed:fresh-local` berhasil: 1 ADMIN (`superadmin@gmail.com`), 1
  OUTBRANCH (`sadamalrasyid1@gmail.com`), 42 `Prospect` Mapping dan 42
  `MappingDiscovery` dari workbook lokal, tanpa koordinat rekaan. Pemeriksaan
  baca-saja dari proses terpisah menunjukkan 2 user, 42 prospect, 0 ServiceCase,
  0 FollowUp, 0 banner, dan 1 audit seed. Password acak hanya disimpan pada
  `.data/private-uploads/akun-awal-2026-10-07T03-13-05-297Z.txt`, tidak dicetak
  di output. Seeder menolak database non-lokal/yang tidak kosong dan menolak
  workbook berbeda hash. Data workbook adalah data yang disediakan pengguna;
  status relasi nasabah/produk belum diverifikasi.
- Beranda memakai logo MABES LINK, aset Mandiri/Livin'/Kopra/Livin' Merchant/
  Danantara, alamat cabang, CTA QRIS, FAQ, dan banner yang dapat diunggah oleh
  petugas login cabang 11539. Banner disimpan di volume privat persisten,
  dikonversi ke WebP tanpa EXIF, ditampilkan publik, dibatasi ukuran/rasio/jumlah,
  dan perubahan diaudit. Logo login kembali ke beranda; logo area kerja menuju
  dashboard. Google Maps Embed hanya aktif jika `GOOGLE_MAPS_EMBED_KEY` tersedia;
  tanpa key ada kartu alamat dan tautan Maps. Key Embed harus dibatasi referrer.
- Pengguna meminta **tanpa build/lint/typecheck/tes/smoke** pada perubahan ini.
  Karena itu seluruh pemeriksaan tersebut **belum dijalankan ulang setelah reset
  dan penambahan banner/beranda**. Hasil lulus yang dicatat di bawah adalah
  historis untuk commit/perubahan sebelumnya, bukan klaim verifikasi terbaru.
  Unggah banner, login dua akun, tampilan desktop/HP, iframe Maps, serta email
  SMTP nyata belum diuji dalam perubahan ini. Tidak ada deployment publik.

## Riwayat sebelum reset 7 Oktober 2026

Pada iterasi sebelumnya repo existing dilanjutkan tanpa mengganti stack, reset database operasional, atau deployment publik. Saat itu seeder data bisnis belum ada dan `seed:roles` hanya untuk empat akun testing pada database terpisah `mabeslink_test`. Catatan bagian ini bersifat historis; status database terkini ada di bagian paling atas.

Sebelum reset, database lokal mempertahankan cabang `11539` dan migration existing. Kini dua akun dibuat oleh `seed:fresh-local` dengan password acak, bukan kredensial default. `bootstrap:admin` hanya diperlukan bila belum ada ADMIN aktif dan menolak berjalan bila ADMIN operasional sudah tersedia. Role aplikasi hanya `ADMIN`, `CS`, `SUPERVISOR`, dan `OUT_BRANCH`; UI menampilkan label `OUTBRANCH` tanpa mengganti enum database existing.

Implementasi lulus build dan pemeriksaan yang tercantum di bawah, tetapi belum dinyatakan production-ready. Approval keamanan/infrastruktur, konfirmasi proses CAKRA, drill restore, SMTP resmi, deliverability, dan pengujian notifikasi pada perangkat organisasi masih diperlukan.

## Arsitektur dan versi

- Web/backend: Next.js App Router 16.3.8, React 19.2.8, TypeScript 5, Route Handlers Node.js.
- UI: Tailwind CSS 4, Leaflet 1.9.4, React Leaflet 5.0.0.
- Data: PostgreSQL 16, Prisma/Prisma Client 7.10.0, waktu `timestamptz(3)` dan tampilan Asia/Jakarta.
- Auth: Better Auth 1.7.7, password hash library, signup publik nonaktif, cookie session HTTP-only/SameSite dan secure pada production.
- Validasi/delivery/media: Zod 4.6.5, Nodemailer 10.0.13, Sharp 0.35.5.
- Scheduler: proses Node.js terpisah, outbox PostgreSQL, locking `SKIP LOCKED`, lease, retry/backoff, heartbeat, dan recovery restart.
- Deployment: satu image aplikasi dengan service Compose terpisah untuk migration, web, worker, PostgreSQL, foto privat, dan backup.

Alur request: UI/Route Handler → session → pemeriksaan role/cabang/penugasan → Zod → service/transaksi Prisma → PostgreSQL/AuditLog. Alur reminder: jadwal PostgreSQL → claim atomik → validasi ulang versi/status/PIC → Notification persisten → email opsional di luar transaksi → status delivery.

## Migration dan skema

Empat belas migration tersedia di repo. Migration terbaru `20261006160000_mapping_excel_import` menambah kolom nullable `Prospect.mappingImportedAt` dan indeks cabang secara non-destruktif; telah diterapkan pada database lokal operasional serta testing tanpa reset. Migration enum `20261006150000_expand_mapping_icons` dan migration QRIS sebelumnya tetap terpasang. Migration lain menambahkan katalog/status/target akuisisi pada `ServiceCase`, metadata consent QRIS publik pada `Prospect`, sesi desain sementara, dan rate limit PostgreSQL. `Prospect.createdById` nullable untuk permintaan publik yang memang tidak memiliki akun internal; record internal existing tetap utuh. Migration multi-PIC, soft-delete, snapshot audit, serta ikon mapping sebelumnya dipertahankan.

Model penting tetap: `Prospect`, `FollowUp`, `Visit`, `HandoverBatch`, `ExceptionCase`, `UsageVerification`, `ServiceCase`, `Notification`, `OutboxJob`, `EmailDelivery`, `LocationPhoto`, `AuditLog`, dan `WorkerHeartbeat`. Koordinat tersimpan sebagai `Decimal(10,7)`, lokasi/foto memakai record prospek yang sama, dan readiness layanan tetap berbeda dari penggunaan terverifikasi.

## Role dan cakupan server

- `OUT_BRANCH` / label `OUTBRANCH`: prospek yang dibuat/ditugaskan, pekerjaan sendiri, lokasi/visit/follow-up sendiri, dan handover yang dikirim.
- `CS`: pekerjaan yang ditugaskan dan handover yang diterima; penyelesaian/penggunaan sesuai kewenangan.
- `SUPERVISOR`: seluruh data non-test cabangnya, assign/reassign, verifikasi, dan penutupan.
- `ADMIN`: visibilitas dan administrasi lintas cabang, seluruh mapping operasional, akun, dan konfigurasi. ADMIN tetap tidak memalsukan pengakuan penerimaan yang secara audit harus dilakukan PIC penerima.

Scope diulang pada query API, mutation, SSE, dan akses gambar. ADMIN tidak mendapat akses tersirat ke CAKRA/core banking.

## Perubahan selesai

### Katalog Akuisisi Nasabah dan QRIS Custom publik

- `/work` memakai 9 kategori bertingkat dengan pencarian produk. `ServiceCase` existing menyimpan kategori/produk, status akuisisi (`PROSPECT`, `FOLLOW_UP`, `PROCESS`, `SUCCESS`, `UNSUCCESSFUL`), target/realisasi/satuan, kontak opsional, PIC, jadwal, dan next action. Filter kategori/status/pencarian serta detail/edit progress ditambahkan. Kode produk dan label tertentu perlu validasi pemilik produk Bank Mandiri sebelum penggunaan data nyata; aplikasi tidak menganggap katalog sebagai keputusan produk resmi.
- Home tanpa login mempunyai CTA **Buat QRIS Custom Gratis**. `/qris-custom` tidak memerlukan sesi, sedangkan API data internal tetap membutuhkan autentikasi. Wizard lima langkah: informasi usaha/lokasi/consent, unggah QRIS, template, editor, validasi/unduh. Peta hanya mengirim permintaan tile untuk area tampilan; lokasi usaha dapat memakai alamat minimum, pin, koordinat manual, atau geolocation sekali setelah izin.
- JPG/PNG/PDF satu halaman maksimal 8 MB diperiksa isi, MIME, dimensi, dan QR yang dapat dibaca. Sumber dire-encode sebagai PNG privat sementara dengan token acak dan expiry 24 jam; worker membersihkan sesi kedaluwarsa setiap 15 menit. Tombol hapus langsung juga tersedia. Tidak ada file sumber atau token pada URL publik/log. Form intake dan consent divalidasi di route upload; tanpa consent dihubungi tidak dibuat prospek.
- Pilihan publik memakai dua PNG 1064×1478. QR resmi dikomposit **di belakang** template dan dapat dizoom 70-140% serta digeser hanya dalam ruang tengah; output diperiksa ulang agar kode tetap dapat dipindai. Teks bawah dapat diatur gaya/ukuran/ketebalan/warna. Koleksi kini 20 stiker vektor, maksimal tiga posisi yang dapat digeser di panel bawah; unggahan sendiri tetap divalidasi dan metadata dihapus. Halaman `/qris-registrations` memuat data pengunjung yang menyetujui kontak dari `Prospect` existing, dibatasi server ke ADMIN atau OUTBRANCH cabangnya. Pilihan template disimpan pada prospek setelah render berhasil melalui tautan request ID sesi. Migrasi penambahan kolom nullable dan indeks `20261006120000_qris_design_selection` telah diterapkan ke PostgreSQL lokal (`localhost:5434`) pada 2026-10-06; ini memperbaiki error generik akibat kolom yang belum ada. Form kini mewajibkan nama kontak/nomor HP hanya jika setuju dihubungi, menyediakan pemilih tanggal-jam WIB opsional, pesan validasi spesifik, dan toast kanan atas. Prisma Client diregenerasi dan `npx tsc --noEmit` lulus. Build penuh dan tes UI belum dijalankan.
- Log berikutnya menunjukkan `PrismaClientValidationError: Unknown argument publicRequestId` dari proses web yang masih memegang Prisma Client lama, bukan migrasi DB yang gagal. `npm run dev`/`npm run dev:web` sekarang menerapkan migrasi dan generate client sebelum Next.js mulai; proses web lama tetap harus dihentikan dan dijalankan ulang. Pada pemeriksaan terakhir `prisma migrate status` menyatakan DB lokal up to date dan `npm run db:generate` berhasil. Respons publik untuk client usang kini spesifik tanpa membuka data formulir.
- Jika consent dihubungi diberikan, transaksi membuat satu `Prospect` existing dengan `publicQrisRequestId` dan `publicDedupKey` unik, `FollowUp`/job reminder internal, notifikasi PIC cabang 11539, dan audit tanpa menulis identitas kontak dalam notifikasi. Permintaan tampil dalam Mapping internal dengan label **penggunaan belum diverifikasi**. Penempatan PIC memakai petugas aktif cabang 11539, bukan pencocokan geospasial atau integrasi CAKRA.
- Rate limit PostgreSQL per aksi, cek origin, ukuran request, sesi bertoken, storage di luar webroot, dan validasi logo server tersedia. `PUBLIC_RATE_LIMIT_TRUST_PROXY` default `false`; mode IP per pengguna hanya aman di balik proxy yang membersihkan header klien. Output tidak mengandung data form kontak kecuali teks desain yang pengguna sendiri pilih. Compose production mengikat port web ke loopback; tidak ada deployment publik.

### Janji akuisisi, mapping penggunaan, dan detail notifikasi

- Menu **Akuisisi Nasabah** kini membuka form **Buat janji** langsung tanpa meminta referensi existing/CAKRA. Form menerima orang yang ditemui, nama toko/usaha opsional, alasan/tujuan, beberapa PIC CS/OUTBRANCH dalam cabang yang sama, waktu WIB, pin peta/geolocation/koordinat manual, pencarian titik tersimpan, label lokasi, serta foto opsional. Referensi kerja lokal dan `ServiceCase` dibuat atomik pada model existing; kesesuaiannya dengan master CAKRA belum disetujui dan dicatat di `CAKRA_NON_DUPLICATION.md`.
- Pembuat, supervisor cabang, dan ADMIN dapat menghapus kartu melalui konfirmasi. Implementasi memakai `deletedAt`, membatalkan status/reminder, menyembunyikan kartu dari scope, dan menyimpan audit; bukan hard-delete.
- Penyimpanan janji memperbarui konteks pada `Prospect` existing dengan optimistic concurrency (`version`) dan audit `APPOINTMENT_CONTEXT_UPDATED`, lalu membuat `ServiceCase` berstatus janji `CONFIRMED`. Foto melewati endpoint privat dan validasi/re-encode server existing; kegagalan foto tidak menghilangkan janji yang sudah berhasil disimpan dan dilaporkan jelas ke pengguna.
- Reminder untuk janji `CONFIRMED` dijadwalkan terhadap `appointmentAt` pada T−30, T−25, T−20, T−15, T−10, T−5, dan T0. Worker tetap memvalidasi ulang versi, PIC, status janji, dan status kasus; reschedule, selesai, atau batal membatalkan seluruh rangkaian lama.
- Mapping mengambil prospek lokasi, penggunaan produk `VERIFIED`, serta permintaan QRIS Custom publik yang memberi consent; label membedakan ketiganya. Tombol **Tambah lokasi** tersedia bagi seluruh role login sesuai scope cabang; ADMIN dapat memilih PIC dari cabang mana pun. Pembuatan lokasi baru memakai transaksi `Prospect` + `MappingDiscovery` + notifikasi + audit, koordinat opsional, kebutuhan default belum dikonfirmasi, dan tidak lagi otomatis membuat `UsageVerification`. Verifikasi penggunaan tetap alur terpisah.
- Marker memiliki pilihan ikon persisten toko/kuliner/belanja/kantor/kesehatan/jasa, palet status/biru/hijau/ungu, skala 30–58 px, pilihan marker aktif, dan fokus otomatis ke hasil filter. Ikon dapat diganti setelah lokasi dibuat. Lokasi mendukung create/update/clear dan foto mendukung add/replace/delete dengan otorisasi serta audit.
- Halaman **Mapping Janji** menampilkan sebaran janji sesuai scope pekerjaan dengan marker status berbeda, polygon Mangga Besar, foto privat, filter pencarian/PIC/status/waktu, skala marker, dan tautan detail. Pencarian form hanya memakai titik internal yang berwenang dilihat, bukan scraping/geocoder eksternal.
- Create/update/cancel janji, perubahan status layanan, perubahan mapping, dan CRUD foto lokasi membuat notifikasi persisten untuk PIC berwenang. Operasi read tidak membuat notifikasi agar navigasi biasa tidak memicu alarm.
- Semua role login dapat melihat/mengubah mapping dalam cabang yang sama melalui scope Mapping khusus; ADMIN lintas cabang. Perubahan discovery/peluang oleh petugas non-supervisor dibatasi PIC, sedangkan supervisor cabang dan ADMIN dapat mengelola cakupannya. Scope API prospek, pekerjaan, handover, gambar, dan SSE lain tidak dilonggarkan. Audit menyimpan `actorId`, `actorName`, dan `actorRole` pada waktu perubahan.
- Header menampilkan peringatan merah bila heartbeat worker tidak tersedia/kedaluwarsa, karena web yang hidup tidak berarti scheduler aktif. CLI `diagnose:appointment` menampilkan status jadwal/job/notifikasi/heartbeat tanpa identitas nasabah.
- Lonceng notifikasi membuka dropdown ringkas. **Lihat detail** menutup dropdown lalu membuka modal detail; penandaan dibaca dan focus restore ke lonceng tetap tersedia.

### Akun dan seeder

- `prisma/seed.ts`, seeder data bisnis/notifikasi, `db:seed`, `seed:test-notifications`, `DEMO_PASSWORD`, dan konfigurasi Prisma seed tetap tidak digunakan.
- `seed:roles` membuat tepat empat akun `.test` untuk `ADMIN`, `CS`, `SUPERVISOR`, dan `OUT_BRANCH`. Perintah wajib memakai database testing bernama mengandung `test`, flag izin, dan konfirmasi eksplisit; production ditolak.
- Password acak di-hash melalui Better Auth dan hanya ditulis ke `role.md` privat yang diabaikan Git. Run ulang tidak menggandakan akun atau mengganti password; `seed:roles:remove` hanya menargetkan empat ID uji.
- Suite integrasi membuat fixture unik sendiri dan membersihkannya; tidak bergantung pada akun/data seed.
- `bootstrap:admin` membuat tepat satu ADMIN awal, menolak overwrite, menolak jika ADMIN aktif sudah ada, memakai password kuat dari environment, dan tidak mencetak password.
- Pembersihan lokal menghapus 7 akun test, 6 prospek test, 3 service case terkait, serta relasi/audit/delivery test. Cabang 11539 dan migration dipertahankan.

### Mapping Mangga Besar

- Overlay polygon interaktif memakai geometri WGS84 yang disederhanakan dari FeatureServer GIS Pemprov DKI untuk Kelurahan Mangga Besar (`KDEPUM 3173031005`).
- Peta dapat menampilkan/sembunyikan batas, fokus ke wilayah, memilih titik/marker, mencari nama/toko/PIC, serta memfilter status, PIC, kategori, jadwal, dan posisi di dalam/luar batas. Popup marker menampilkan kode, status, PIC, jadwal, dan tautan Google Maps berbasis koordinat.
- Titik di luar batas mendapat peringatan dan konfirmasi; overlay diberi label sebagai referensi administratif, bukan penetapan wilayah kerja cabang.
- Header desktop dan kartu scope menampilkan role/cakupan aktif. ADMIN ditandai akses superadmin lintas cabang; navigasi menambahkan **Mapping Janji** di samping **Akuisisi Nasabah** dan **Mapping** penggunaan.
- Fitur existing tetap: lokasi manual/pin/geolocation, Google Maps URLs, Haversine, urutan terdekat, dan foto privat.

### Notifikasi laptop/HP

- Tombol Notifikasi sekarang membuka dropdown daftar terlebih dahulu; modal detail hanya muncul setelah **Lihat detail** dipilih. Badge unread, status SSE/polling, tandai dibaca/semua dibaca, tautan internal, loading, empty, error, waktu WIB, dan deduplikasi tetap tersedia.
- Halaman **Pengaturan Notifikasi** terpisah menyediakan **Aktifkan Suara**, **Tes Suara**, **Tes alarm waktu janji**, volume 0-100%, mute, stop, pengulangan 1/3/5/10/20 kali, pilihan jenis reminder, file alarm lokal opsional, izin notifikasi sistem, dan status aktif/perlu aktivasi ulang. Alarm T0 memakai pola nada/vibrasi yang berbeda, tempo lebih rapat, gain aplikasi lebih tegas, dan minimal lima putaran; batas volume browser/perangkat tetap dihormati. Jadwal global hanya dapat diubah ADMIN.
- Prompt aktivasi dengan tombol “Nanti” tidak lagi muncul otomatis sesudah login. Pengaturan memakai tombol hijau untuk mengaktifkan serta merah untuk mematikan; hapus ringtone dan logout menggunakan dialog konfirmasi.
- Pengelola audio singleton memakai `AudioContext`/`GainNode`, dibuat atau dilanjutkan hanya dari klik pengguna, menghentikan nada lama sebelum nada baru, dan menyimpan preferensi per user/perangkat tanpa menganggap autoplay telah terbuka setelah reload.
- Akar masalah implementasi lama diperbaiki: `AudioContext` sebelumnya hanya dibuat bersamaan dengan izin notifikasi browser, dan effect SSE dibuat ulang setiap perubahan mode/pengulangan. Aktivasi audio kini mandiri dan koneksi SSE tidak bergantung pada kontrol suara.
- Service worker `public/mabeslink-notifications-sw.js` menampilkan notifikasi sistem yang dapat membuka tautan internal; URL lintas origin ditolak.
- Riwayat lama tidak dibunyikan. Paling banyak satu alarm janji belum dibaca yang dibuat dalam 15 menit terakhir dipulihkan sekali setelah audio diaktifkan ketika aplikasi dibuka kembali. Cursor SSE dimulai setelah initial fetch, claim `localStorage` dan `BroadcastChannel` mengurangi duplikasi antar-tab/reconnect. Janji terkonfirmasi sekarang dijadwalkan tepat 30 menit sebelum dan pada `appointmentAt`, dikategorikan sebagai suara janji, dan menjadi pengecualian jam senyap; quiet hours tetap mematikan bunyi reminder umum tanpa menyembunyikan notifikasi visual.
- Preferensi audio yang sudah aktif dipersenjatai kembali pada interaksi pertama setelah reload. Ini tetap mematuhi autoplay policy browser; bila browser menolak, pengguna memakai **Aktifkan Suara**.
- File alarm maksimal 5 MB/30 detik didecode browser, disimpan per user/perangkat di IndexedDB, tidak dikirim ke server, dan dapat diganti/dihapus. Notifikasi baru juga menghasilkan toast kecil di kanan atas; tombol stop membatalkan seluruh sumber audio terjadwal agar tidak menumpuk.
- Fitur memerlukan HTTPS/localhost, izin pengguna, dan dukungan browser. Saat ini alarm perangkat aktif selama MABES LINK terbuka; ketika browser tertutup, sumber persisten adalah worker/outbox dan email bila SMTP aktif. Web Push background belum diimplementasikan.

### SMTP

- Environment memakai host `smtp-relay.brevo.com`, port `587`, login `bc7ba9001@smtp-brevo.com`, dan sender `MABES LINK <aturbabyincubator@gmail.com>`. `SMTP_PASS` tetap kosong, `EMAIL_ENABLED=false`, dan `SMTP_DRY_RUN=true`; tidak ada key yang dibuat atau dicetak.
- Transport Nodemailer memakai port 465 sebagai implicit TLS atau STARTTLS wajib untuk port lain, TLS minimum 1.2, certificate verification default, serta timeout koneksi/greeting/socket.
- `smoke:test-email` tidak lagi bergantung pada seed/job test. Recipient dikunci ke `sadamalrasyid1@gmail.com`, harus berupa akun internal non-test aktif yang mengizinkan email, template tidak berisi identitas nasabah, transport diverifikasi, dibatasi satu percobaan persisten per hari WIB, dan opt-in `EMAIL_ENABLED=true` + `SMTP_DRY_RUN=false` wajib.
- Jalur reminder operasional tetap melalui worker/outbox dan menyimpan `messageId`/status. `SMTP_ACCEPTED` tidak dianggap bukti pesan masuk inbox.
- Template internal memuat kalimat “Sudah waktunya membuat atau mengonfirmasi janji follow-up.”, waktu WIB, kode tugas, dan tautan login tanpa identitas nasabah.

### Finishing UI dan konfigurasi

- Dialog bersama memiliki tombol X 44 px, Escape, klik overlay, focus trap/restore, `inert` background, scroll lock, sticky footer, konfirmasi perubahan belum disimpan, z-index di atas Leaflet, animasi 200 ms, dan `prefers-reduced-motion`.
- Form prospek, pekerjaan, batch payroll, alasan status, dan seluruh konfirmasi penting memakai dialog/feedback konsisten; native `alert`, `prompt`, dan `window.confirm` tidak lagi dipakai.
- Toast global, loading/disabled, retry error, badge unread, status SSE/polling, dan reset filter ditambahkan. Input form tetap berada di state DOM bila request gagal.
- `.env.local`/`.env.example` dikelompokkan menjadi APP, AUTH, DATABASE, SMTP, WORKER, NOTIFICATIONS, STORAGE, dan TESTING. Key legacy `DEMO_PASSWORD`/`NEXT_PUBLIC_APP_URL` dihapus, tidak ada duplikasi, dan script Node/test memuat urutan environment Next melalui `@next/env`. Konfigurasi lokal kembali menetapkan `ALLOW_MANUAL_REFERENCE_ENTRY=false`.
- Logo visual aplikasi memakai `/Gambar/logo-white.png` dengan latar brand agar tetap terbaca pada sidebar maupun permukaan terang.
- `postinstall` dan `prebuild` menjalankan `prisma generate`. Seluruh Client Component tidak lagi mengimpor runtime `@prisma/client`, sehingga Turbopack tidak mencoba membundel `.prisma/client/index-browser`; build telah diuji dari kondisi generated client belum tersedia.

## Endpoint dan file penting

- Health/auth: `GET /api/health`, `/api/auth/[...all]`.
- Pekerjaan: `/api/service-cases`, `/api/follow-ups`, `/api/handovers`, `/api/usage-verifications`.
- Janji/mapping: `POST /api/appointments`, `/api/service-cases/:id`, `/appointment-map`, `GET/POST /api/mapping`, `PATCH /api/mapping/:id`, `/api/visits`, `/api/prospects/:id`, endpoint foto privat.
- Notifikasi: `/api/notifications`, `/api/notifications/:id`, `/api/notifications/stream`.
- Admin: `/api/admin/users`, `/api/admin/config`, `/api/admin/notification-config`.
- Peta: `components/mapping-create-form.tsx`, `components/mapping-map.tsx`, `components/mapping-workspace.tsx`, `lib/mapping-icons.ts`, `lib/services/mapping.ts`, `lib/mangga-besar-boundary.ts`.
- Alarm/pengaturan: `components/notification-center.tsx`, `components/notification-audio-settings.tsx`, `public/mabeslink-notifications-sw.js`.
- Dialog/feedback/audio: `components/ui/dialog.tsx`, `components/ui/feedback.tsx`, `lib/client/notification-audio.ts`.
- Worker/SMTP: `worker/index.ts`, `lib/notifications.ts`, `scripts/smoke-test-email.ts`.
- Provisioning: `scripts/bootstrap-admin.ts`.
- Testing role: `scripts/seed-roles.ts`, `scripts/role-access-check.ts`, `scripts/start-test-server.ts`, `role.md` (lokal/ignored).
- QRIS Custom: `app/qris-custom/page.tsx`, `components/qris-custom-editor.tsx`, `app/api/qris-custom/{upload,contact,render,session}/route.ts`, `lib/qris-{custom,design,render,cleanup}.ts`, `lib/services/public-qris.ts`, `scripts/qris-visual-check.ts`, `scripts/qris-api-smoke.ts`.
- Katalog: `lib/acquisition-products.ts`, `components/service-case-form.tsx`, `app/(app)/work/page.tsx`, dan dua migration terbaru.

## Cara menjalankan

```powershell
Copy-Item .env.example .env.local
# Isi BETTER_AUTH_SECRET.
docker compose up -d postgres
npm ci
npm run db:generate
npm run db:deploy
$env:BOOTSTRAP_ADMIN_NAME='Administrator MABES LINK'
$env:BOOTSTRAP_ADMIN_EMAIL='admin-internal@example.com'
$env:BOOTSTRAP_ADMIN_PASSWORD='password-kuat-yang-ditentukan-sendiri'
npm run bootstrap:admin
Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD
npm run dev:all
```

`npm run dev` menjalankan pasangan web+worker yang sama. Gunakan `npm run dev:web` hanya bila worker dijalankan terpisah.

Worker harus selalu berjalan terpisah dari web. Reverse proxy internal harus menyediakan HTTPS agar cookie production, geolocation, service worker, dan notifikasi perangkat berfungsi.

Untuk role testing, buat database terpisah `mabeslink_test`, deploy migration ke database tersebut, isi flag TESTING dari `.env.example`, lalu jalankan `npm run seed:roles`. Kredensial aktual berada hanya di `role.md`. Gunakan `npm run start:test` dan `npm run test:roles`; hapus akun dengan `npm run seed:roles:remove` menggunakan pengaman yang sama.

## Hasil pemeriksaan aktual

- Prisma format/validate: berhasil.
- Pemeriksaan historis: 11–14 migration pada iterasi sebelumnya. Status 6 Oktober 2026: 16 migration terpasang pada database lokal dan testing, tanpa reset.
- Typecheck: berhasil.
- ESLint: berhasil tanpa error/warning setelah perbaikan effect izin notifikasi.
- Pemeriksaan historis: 9 file / 45 tes hingga 10 file / 50 tes pada iterasi sebelumnya. Suite terbaru: 11 file / 57 tes berhasil.
- `test:roles` membuktikan login UI keempat role, menu Manajemen Pengguna hanya ADMIN, API admin 200 untuk ADMIN/403 untuk tiga role lain, API mapping dan halaman Mapping Janji 200 sesuai sesi, serta route `/admin` dialihkan untuk non-ADMIN.
- Production build: berhasil; 34/34 halaman statis selesai dan route dinamis termasuk `/api/appointments`, `/appointment-map`, `/notification-settings`, serta empat route QRIS Custom terdaftar. Regresi Prisma Client Browser tidak muncul. Paket native canvas PDF dikecualikan dari bundling server Next.js dan tersedia sebagai dependency Node runtime.
- UI 1440×900, 768×1024, 390×844, dan 360×800: Mapping penggunaan serta Mapping Janji, dialog **Tambah lokasi**, pemilih ikon, koordinat manual, polygon, filter, scope/header role, tile attribution, dan navigasi mobile tampil tanpa overflow horizontal atau console error. Prompt “Nanti” tidak muncul setelah login. Tes headless juga memeriksa dropdown/modal notifikasi, focus restore, dialog konfirmasi, kontrol audio, pengulangan, dan decode/upload WAV lokal.
- Smoke alarm non-headless berhasil di Microsoft Edge dan Google Chrome: akun uji sementara login, audio diaktifkan melalui klik browser, notifikasi `APPOINTMENT_ACTION_DUE` persisten diterima melalui SSE, toast muncul, dan Web Audio dijadwalkan lima kali. Script membersihkan akun/notifikasi uji. Opera dan Safari tidak terpasang pada mesin Windows ini sehingga tidak diklaim teruji langsung.
- UI QRIS publik diuji di Edge headless pada lebar 360/390/768/1440 px tanpa overflow atau `pageerror`; alur form wajib, upload QR samaran, template, preview editor, PDF download valid, dan hapus sesi lulus. Bug Edge yang mengosongkan respons `fetch` PDF saat `Content-Disposition` dipasang ditemukan dan diperbaiki; unduh kini memakai Blob URL dari respons tanpa header tersebut. API smoke PNG/PDF via HTTP pada database testing mengembalikan 200 dan header file valid.
- Smoke SMTP nyata dijalankan dengan opt-in sementara, tetapi berhenti sebelum koneksi karena `SMTP_PASS` kosong. Tidak ada email yang dikirim dan tidak ada klaim inbox. `EMAIL_ENABLED=false` serta `SMTP_DRY_RUN=true` tetap menjadi nilai aman pada environment lokal.
- Data operasional existing tidak diubah atau dihapus. Empat akun role `.test` tetap terisolasi di `mabeslink_test`; fixture integrasi/visual lain dibersihkan otomatis.
- Warning driver `pg` tentang `client.query()` bersamaan telah dihilangkan dengan membuat query baca pada satu client berjalan berurutan; transaksi mutation tetap digunakan. Suite tes terakhir tidak menampilkan warning tersebut.

## Pembaruan UI, pencarian tempat, dan heatmap (6 Oktober 2026)

- Modal **Buat janji akuisisi** kini menampilkan alasan validasi spesifik dari API beserta nama field, dan memfokuskan field yang perlu diperbaiki. Pencarian produk/titik tersimpan memakai debounce 220/260 ms; QRIS Custom memakai debounce 500 ms dan membatalkan permintaan lama. Label pencarian tetap terlihat meskipun placeholder hilang saat ada teks.
- Ikon peta diperluas dari 6 menjadi 26 pilihan, termasuk menara. Picker yang sama dipakai oleh pembuatan janji, penambahan lokasi mapping, dan pengubahan ikon mapping; pilihan janji disimpan pada `Prospect.mappingMarkerIcon` dan tampil pada peta janji. Heatmap mendapat radius, opasitas, dan opsi menampilkan pin di atas kepadatan. Migration enum bersifat additive.
- Pemeriksaan terbaru: migration additive diterapkan ke database lokal operasional dan `mabeslink_test`; `npm run typecheck`, `npm run lint`, `npm run build`, serta `npm test` lulus (10 file/49 tes). `npm run test:visual` lulus pada 1440/768/390/360 px, termasuk respons 422 yang menampilkan **Nomor HP: Nomor HP tidak valid** di modal, ikon Menara, dan kontrol heatmap. Setelah nomor diperbaiki, serialisasi payload UI tervalidasi terhadap skema dengan endpoint tiruan (tanpa membuat record). Integrasi pembuatan janji nyata tetap tercakup pada tes service/DB. `npm run test:qris-visual` lulus pada empat lebar yang sama. Kepadatan heatmap dengan dataset besar dan pencarian provider eksternal belum diuji.

- Favicon Vercel diganti dengan monogram MABES LINK (`app/favicon.ico`, `public/app-icon.png`), dibuat ulang melalui `scripts/make-favicon.ts`. Warna, tipografi, tabel, form, navigasi desktop/HP, header halaman, dan wizard QRIS dirapikan memakai komponen/style bersama; ini bukan klaim bahwa semua layar bespoke telah didesain ulang satu per satu.
- QRIS Custom memiliki pencarian tempat lewat endpoint Photon-compatible yang URL-nya disetel hanya di server (`LOCATION_SEARCH_URL`). Endpoint membatasi frekuensi, ukuran kueri, email/nomor pribadi, timeout, dan hanya mengembalikan label/koordinat. Default nonaktif sampai organisasi menyediakan penyedia yang disetujui. Tautan Google Maps serta pemilihan pin/koordinat manual tetap tersedia. Tidak ada scraping atau geocoding publik otomatis.
- Peta operasional mempunyai mode heatmap canvas di browser, memakai data yang sama dan sudah dibatasi role/cabang/filter; pilihan kepadatan semua titik, penggunaan terverifikasi, atau perlu tindakan. Halaman peta memuat maksimal 1.000 lokasi terbaru, sehingga heatmap bukan analisis seluruh wilayah.

## Impor/ekspor Excel Mapping (6 Oktober 2026)

- Halaman `/mapping` kini mempunyai tombol berikon spreadsheet untuk mengunduh template, mengekspor data, dan mengimpor XLSX. API `GET/POST /api/mapping/excel` memerlukan sesi; ekspor/preview/commit diperiksa terhadap scope role/cabang di server. Template berisi sheet `Mapping` dan `Petunjuk` dengan kolom wajib/opsional. Ekspor mencakup seluruh lokasi dalam cakupan hingga batas eksplisit 5.000 record dan mencatat audit; layar peta memuat 1.000 terbaru dan menampilkan total.
- Template punya sheet `Mapping`, `Petunjuk` dengan legenda hijau=wajib/biru=opsional/kuning=kondisional, satu baris usaha samaran di sheet `Contoh` yang tidak diimpor, dan sheet `Pilihan Ikon` berisi kode/nama/contoh visual 26 ikon. Latitude/longitude kini benar-benar opsional untuk lokasi baru: kosong keduanya menghasilkan record tanpa pin sampai koordinat ditambahkan; satu saja ditolak. Contoh format koordinat dan peringatan agar tidak memakai 0,0 sebagai pengganti lokasi kosong tertulis di petunjuk.
- Impor maksimal 250 baris/1,5 MB: validasi header, pasangan/rentang koordinat, email PIC aktif satu cabang, ikon, duplikat (termasuk nama sama tanpa koordinat), formula/hyperlink, versi record, serta pratinjau kesalahan per baris. Kode internal kosong membuat `Prospect` baru dan kode otomatis; kode+versi dari ekspor memperbarui record mapping yang sudah ada. Kolom opsional kosong pada update mempertahankan nilai lama. PIC/cabang untuk baris baru diisi otomatis dari akun bila tepat dan diizinkan; PIC existing tidak boleh diganti lewat Excel agar tugas terkait tetap konsisten. Commit memakai transaksi serializable dan audit per record; konflik meminta ekspor ulang. File XLSX tidak disimpan permanen.
- Record baru diberi `mappingImportedAt` dan `locationSource=EXCEL_IMPORT`, tetapi **tidak membuat `UsageVerification`**. Status di daftar/peta tetap “penggunaan belum diverifikasi”; setelah pin diedit manual record tetap masuk daftar karena penanda impor terpisah. Tidak ada database prospek kedua atau integrasi CAKRA/geocoding.
- `npm run db:deploy` berhasil pada database lokal `mabeslink` dan `mabeslink_test`; `npm run typecheck`, `npm run lint -- --quiet`, `npm run build`, dan `npm run test` (10 file/50 tes) lulus setelah migration testing diterapkan. Tes Excel membuktikan contoh tidak ikut diimpor, warna header/ikon contoh, koordinat kosong dan 0 yang valid, izin lintas cabang, ekspor sesuai cakupan, duplikat, optimistic version, kolom kosong yang mempertahankan nilai lama, penolakan formula/koordinat invalid, notifikasi PIC lokasi baru, dan tidak terbentuknya verifikasi penggunaan. `npm audit --omit=dev` melaporkan 0 temuan setelah pin `uuid` transitif ExcelJS 11.1.1. `npm run test:visual` lulus pada 1440/768/390/360 px; dialog impor tidak overflow dan screenshot disimpan di `.artifacts`. Pengujian manual dengan Excel desktop/HP serta uji beban XLSX besar belum dilakukan.

## Mapping & cross-selling — pembaruan 6 Oktober 2026

- Skema additive `20261006170000_mapping_discovery_cross_sell` menambah `MappingDiscovery` (satu per `Prospect`) dan `MappingOpportunity` (unik prospek × produk), enum respons/screening, indeks, FK, versi optimistis, dan audit. Migration `20261006173000_mapping_source_hint` menyimpan petunjuk kebutuhan hasil Excel tanpa menganggapnya terkonfirmasi. Kedua migration menyediakan `rollback.sql` untuk review/backup; rollback destruktif **tidak** dijalankan. Database lokal `mabeslink` dan `mabeslink_test` menerima migration melalui deploy tanpa reset.
- Tambah lokasi Mapping kini menghasilkan `Prospect` + `MappingDiscovery` + notifikasi/audit, tanpa `UsageVerification`. Koordinat boleh kosong; kebutuhan default `Belum dikonfirmasi`. Impor Excel mempertahankan tepat 14 kolom `Mapping`; `kebutuhan` dari sheet disimpan sebagai petunjuk awal. Workbook revisi pengguna 40.157 byte berisi 42 baris Mapping yang lolos parser; sembilan sheet pendamping tidak otomatis menciptakan lead atau mengonfirmasi produk. File asli tidak diubah dan tidak diimpor otomatis saat startup.
- Layar Mapping menambah filter gabungan segmen 3P+1I, tag peluang, hasil screening Livin’ Food, dan flag manual perlu review Risk/Compliance. Detail lokasi memiliki produk **sudah digunakan** terpisah dari **yang ditawarkan**, sumber/tanggal verifikasi, checklist discovery, kebutuhan yang dinyatakan, manfaat yang dijelaskan, respons, izin follow-up, PIC, next action, dueAt WIB, dan bukti proses non-sensitif. Form/endpoint memakai validasi server, scope role/cabang/PIC, optimistic version, transaksi serializable, audit, dan pemeriksaan origin request mutasi. Tidak ada CIF baru dalam Mapping, Excel, email, atau peta.
- Screening GoFood/GrabFood manual: rating ≥4,5 dan ≥500 review, opsi salah satu/kedua platform, URL HTTPS, tanggal pengecekan, serta status stale setelah 30 hari. Ini **asumsi screening pengguna**, bukan persyaratan atau approval resmi. Tidak ada scraping/API platform. Sektor hanya memunculkan saran pertanyaan; tidak mengisi produk yang dimiliki ataupun keputusan kelayakan.
- `MappingOpportunity` menghubungkan prospek×produk dengan `FollowUp` existing. Respons `FOLLOW_UP` membuat tugas dan outbox reminder; pergantian PIC/jadwal mengganti versi reminder, respons akhir membatalkan reminder aktif. `NOT_INTERESTED`/`NOT_RELEVANT` sah. Penawaran ditolak server kecuali kode produk terdapat dalam `MAPPING_APPROVED_PRODUCT_CODES`; default kosong menunggu persetujuan internal. Nama publik empat kode katalog memiliki rujukan situs Bank Mandiri, tetapi otorisasi cabang tidak terbukti. CAKRA tetap tanpa API/deep link yang disetujui.
- File penting: `prisma/schema.prisma`, dua migration baru, `lib/mapping-discovery.ts`, `lib/services/mapping-discovery.ts`, `app/api/mapping/[id]/{discovery,opportunities}/route.ts`, `components/mapping-discovery-panel.tsx`, `lib/mapping-xlsx-reader.ts`, `lib/mapping-excel.ts`, dan `tests/mapping-discovery.test.ts`. Endpoint `GET/PATCH /api/mapping/:id/discovery` serta `POST /api/mapping/:id/opportunities` memerlukan login. Cara run tetap `docker compose up -d postgres`, `npm ci`, `npm run db:deploy`, lalu `npm run dev` (web + worker); jalankan `npm run db:generate` jika Prisma Client belum dibuat. `MAPPING_APPROVED_PRODUCT_CODES` hanya di server. Tidak ditambah seeder bisnis; tes memakai fixture samaran sementara sesuai kebijakan repo sebelumnya.
- Pemeriksaan aktual: `npm run db:deploy` berhasil pada `mabeslink` dan `mabeslink_test`; `npm run db:generate`, `npm run typecheck`, `npm run lint`, `npm test` (**11 file / 57 tes**), serta `npm run build` berhasil (37/37 halaman statis dan rute dinamis baru terdaftar). Tes baru membaca dan merencanakan impor workbook revisi 42 baris tanpa menulis data, memeriksa 14 kolom, ambang/stale screening, validasi checklist, scope lintas PIC/cabang, pembentukan/pembatalan/reassign reminder, dan bahwa Mapping baru tidak otomatis menjadi penggunaan. `npm run test:visual` berhasil pada desktop 1440 px, tablet 768 px, HP 390/360 px dengan satu lokasi samaran sehingga panel discovery benar-benar tampil; pada 360 px dialog tambah lokasi diperiksa untuk overflow tetapi pemilihan ikon/koordinat tidak diklik otomatis. SMTP nyata, API CAKRA, dan kebijakan katalog/risk internal belum terbukti.

### Impor workbook lokal — 7 Oktober 2026

- `scripts/import-supplied-mapping.ts` menambahkan mode pratinjau, commit eksplisit, dan verifikasi. Terbatas pada PostgreSQL lokal, cabang 11539, tepat satu ADMIN aktif sebagai PIC sementara, dan tepat 42 baris baru/0 invalid sebelum commit. Hash SHA-256 workbook yang diproses: `f7155b9122049dd1e3b917910fe3dd72de06389690a8967b0d51f4e5bfdc26af`.
- Pratinjau terhadap database lokal `mabeslink`: **42 tambah, 0 update, 0 invalid**. Atas permintaan pengguna, `npm run mapping:import-commit` berhasil dalam satu transaksi. Audit request ID `local-workbook-d0de0028-24b4-458a-9781-94012aea4a0d` memiliki 42 entri create; verifikasi ulang dari proses terpisah membuktikan 42 `Prospect`, 42 `MappingDiscovery`, 0 `UsageVerification`, dan 42 lokasi tanpa pin. Record existing tidak di-reset atau ditimpa. CLI tidak mengirim email langsung; impor membuat notifikasi penugasan existing untuk PIC sementara.
- Semua 42 lokasi tampak pada daftar Mapping untuk role cabang sesuai scope; belum ada titik peta karena workbook tidak menyediakan lat/long. Data sumber belum diverifikasi terhadap sistem resmi; nama/alamat di workbook tidak otomatis membuktikan relasi nasabah atau penggunaan Mandiri. PIC sementara ADMIN dapat dialihkan menurut proses cabang. Mengulang commit file yang sama akan ditolak sebagai duplikat, bukan menambah 42 record lagi.

### Pembaruan beranda dan verifikasi pin — 7 Oktober 2026

- `/` diganti dengan beranda publik responsif: hero dan animasi ringan yang menghormati reduced-motion, aset logo Mandiri/Livin'/Kopra/Livin' Merchant/Danantara yang sudah ada, mockup QRIS yang diberikan pengguna, pilihan template, FAQ, dan footer. Pengguna login tetap dialihkan ke dashboard operasional, yang mendapat kartu promo QRIS dan footer merek. Mockup adalah ilustrasi, bukan bukti QRIS aktif atau tawaran akrilik gratis.
- Daftar Mapping kini menunjukkan ikon tersimpan dari workbook meski lokasi belum berpeta, jumlah lokasi tanpa pin, filter **Perlu verifikasi titik**, pencarian kandidat alamat setelah klik petugas, tautan Google Maps berbasis alamat, dan konfirmasi sebelum menyimpan koordinat. Provider `LOCATION_SEARCH_URL` belum dikonfigurasi pada environment lokal; tanpa provider, tombol kandidat memberi pesan jujur, sedangkan tautan Google Maps/pin manual tetap berfungsi. Kandidat bukan verifikasi otomatis. Semua 42 record sumber tetap tanpa koordinat, sehingga tidak ada pin rekaan.
- Pengguna mengizinkan hanya 42 mapping impor sebagai cakupan penggantian data. Preflight menemukan tepat 42 record tanpa relasi, tanpa versi berubah, dan tanpa koordinat. `npm run mapping:reseed-workbook` kemudian **berhasil dijalankan sekali** dalam transaksi serializable: 42 record tersebut dihapus lalu direinsert dari snapshot record yang dicocokkan dengan setiap baris workbook ber-hash tetap, dengan ID/kode internal tetap sama, audit ditambah, dan akun/janji/kasus/record lain tidak tersentuh. Verifikasi fresh-process sesudahnya: 42 prospek, 42 discovery, 0 penggunaan, 42 tanpa pin, 0 record terkait/berubah; tujuh jenis ikon tersimpan. Perintah menolak pengulangan atau record yang sudah berubah. `npm run mapping:seed-workbook` tetap idempotent untuk instalasi lokal baru/yang sudah punya 42. Data usaha nyata berada di workbook lokal yang diabaikan Git, bukan di hardcoded seeder.
- Pencarian alamat publik awal tidak cukup untuk memasang pin otomatis: misalnya alamat Olympic Hotel dan 101Urban Jakarta Glodok pada workbook tidak cocok dengan [situs Olympic Hotel](https://olympichoteljakarta.com/contacts/) dan [listing Google Travel](https://www.google.co.id/travel/hotels/entity/ChkIxP_moODK6NQeGg0vZy8xMWJ3OGpfMTR4EAE?gl=id&hl=id). Perlu konfirmasi lokasi/foto/lapangan oleh petugas sebelum koordinat disimpan. Tidak ada klaim 42 alamat telah diverifikasi.
- Pemeriksaan ulang setelah perubahan: `npm run build`, `npm run typecheck`, `npm run lint`, dan `DATABASE_PURPOSE=testing npm test` berhasil; 11 file / 57 tes. Edge headless membuka beranda pada desktop 1440 px dan HP 390 px tanpa overflow horizontal; 9 aset gambar termuat (logo footer baru terlihat setelah scroll karena lazy loading). `npm run test:visual` pada database testing lulus desktop 1440, tablet 768, HP 390/360 px untuk Mapping dan Mapping Janji tanpa console error/overflow. Kandidat dari provider geocoding yang disetujui belum teruji karena provider belum disetel; Google Geocoding API tidak ditambahkan karena memerlukan key/billing dan izin organisasi. Tidak ada deploy publik.


## Belum terbukti / tindak lanjut internal

- QRIS Custom baru diuji dengan QR sintetis tanpa fungsi pembayaran. Keaslian QRIS/merchant, kelengkapan teks/logo wajib, hasil scan dari cetakan fisik, kamera HP, Web Share ke WhatsApp/Instagram, dan browser Safari/Opera belum diverifikasi. QR decoder menyamakan isi QR, bukan memvalidasi penerbit/merchant. Template tidak memakai logo resmi; file referensi `Mandiri QRIS Nusantara Signage Collection.png` tidak terlampir, sehingga kemiripan visual dengan referensi belum dapat dinilai. Persetujuan merek/desain dan legal wajib sebelum publikasi.
- Publikasi eksternal belum dilakukan. Rate limit DB dan origin check adalah lapisan awal; WAF/reverse proxy tepercaya, pembatasan volume upload, kebijakan retensi prospek consent, pengujian beban, dan penilaian privasi diperlukan. Default bucket global saat `PUBLIC_RATE_LIMIT_TRUST_PROXY=false` dapat membatasi banyak pengunjung di satu jaringan; jangan mengaktifkan trust proxy tanpa sanitasi header. Image/PDF parser dan modul native pada image Docker belum diuji end-to-end di container production.

- Kredensial SMTP resmi, sender/domain verification, quota akun aktual, `SMTP_ACCEPTED`, deliverability inbox, bounce, dan email ke alamat uji belum terbukti.
- Notifikasi sistem perlu diuji manual pada laptop/HP organisasi melalui HTTPS dan izin browser. Background notification saat aplikasi tertutup memerlukan desain Web Push/VAPID terpisah; tidak diklaim tersedia.
- Tes suara headless membuktikan kontrol dan Web Audio tidak error, tetapi suara yang benar-benar terdengar pada speaker laptop/HP belum diverifikasi manual.
- Batas wilayah kerja cabang harus dikonfirmasi internal; polygon saat ini hanya referensi administratif sumber publik DKI.
- Kepemilikan master lead/visit/reminder CAKRA, data contract, link/import resmi, rekonsiliasi, dan retensi belum dikonfirmasi pemilik sistem.
- Restore drill database+foto, enkripsi/retensi backup, SSO, CSP/hardening formal, DAST/SAST, pentest, uji beban/failover, alerting, dan approval infrastruktur belum selesai.

Tidak ada deployment publik, data nyata bank, integrasi CAKRA/core banking, keputusan kredit otomatis, atau bypass OTP/biometrik.
