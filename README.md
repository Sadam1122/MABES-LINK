# MABES LINK

Aplikasi operasional internal KCP Mandiri Jakarta Mangga Besar (`11539`, `B.2`) untuk menghubungkan pekerjaan in-branch dan out-branch sampai layanan ditangani, diverifikasi, ditutup, dan penggunaan produk dicatat terpisah.

Implementasi ini disiapkan untuk deployment internal, tetapi **belum dinyatakan production-ready** sebelum approval keamanan/infrastruktur, verifikasi proses CAKRA, uji backup/restore, dan uji SMTP organisasi selesai. Jangan deploy ke internet publik atau memasukkan data nyata bank ke lingkungan development/test.

Halaman awal dan `/qris-custom` dapat dibuka tanpa login **pada host yang diizinkan**. Route internal, prospek, mapping, reminder, dan dashboard tetap memerlukan sesi serta pemeriksaan role/cabang di server. Compose production mengikat web ke loopback `127.0.0.1:3000`; akses pengguna memerlukan reverse proxy HTTPS internal dan persetujuan keamanan sebelum diaktifkan.

## Batas fungsi

- `ServiceCase` adalah alur kerja tunggal: dibuat → ditugaskan → diterima PIC → diproses → selesai ditangani → diverifikasi → ditutup. Menunggu nasabah/sistem, eskalasi, batal, dan reopen tersedia sebagai cabang tervalidasi.
- Menu **Akuisisi Nasabah** membuat janji langsung tanpa meminta referensi CAKRA: isi orang yang ditemui, nama toko/usaha opsional, alasan, satu atau beberapa PIC internal, waktu WIB, titik peta/GPS/koordinat manual, label lokasi, dan foto tempat opsional. Server membuat kode dan referensi kerja lokal pada model `Prospect` yang sama dalam satu transaksi. Ini tidak diklaim sebagai master lead atau integrasi CAKRA.
- Status janji `NEEDS_SCHEDULING` tidak dianggap sebagai janji terkonfirmasi. Email hanya mengingatkan PIC internal untuk membuat atau mengonfirmasi janji; aplikasi tidak mengirim undangan otomatis kepada calon nasabah.
- Penyelesaian layanan tidak otomatis menjadi `UsageVerification`.
- OTP nomor lama, face recognition, blokir/aktivasi, dan pengecualian CSM/Livin tetap mengikuti prosedur resmi; tidak ada bypass.
- Tidak ada integrasi/scraping CAKRA, Kopra, core banking, Google Maps, geocoding, AI berbayar, WhatsApp blast, atau keputusan kredit otomatis.
- Audit non-duplikasi dan keputusan yang belum terverifikasi ada di [CAKRA_NON_DUPLICATION.md](./CAKRA_NON_DUPLICATION.md).

## QRIS Custom dan katalog akuisisi

- `/work` memakai katalog 9 kategori produk/layanan dengan pilihan bertingkat dan pencarian produk. Status akuisisi, target/realisasi beserta satuan, PIC, jadwal, next action, CIF/nomor rekening/HP opsional disimpan pada `ServiceCase` existing; data sensitif opsional hanya terlihat pada halaman internal yang berwenang. Label katalog perlu validasi pemilik produk sebelum dipakai untuk data nyata.
- `/qris-custom` beralur informasi usaha → unggah QRIS resmi → pilih template → kustomisasi → validasi/unduh. Ini editor tampilan, **bukan** penerbitan atau verifikasi resmi QRIS/merchant. Pengguna harus memakai QRIS yang diterbitkan melalui proses resmi dan menguji scan sebelum cetak.
- File JPG/PNG/PDF satu halaman maksimal 8 MB diperiksa signature, decode, dimensi, dan QR yang dapat dibaca. Sumber disimpan privat sementara; layer sumber ditaruh utuh dalam area putih terkunci, tanpa overlay dekorasi. Hasil PNG/JPG/PDF A5/A6 dihasilkan server; QR didecode ulang dan dibandingkan dengan sumber sebelum dikirim. Re-encode/rasterisasi dapat mengubah byte gambar dan tidak menjamin seluruh teks resmi terbaca setelah cetak—periksa hasil fisik.
- Logo usaha JPG/PNG/WebP opsional maksimal 512 KB hanya muncul di luar area terkunci; warna, pola, bingkai, ornamen, ukuran, hemat tinta, undo/redo, dan berbagi file melalui Web Share tersedia. Template dibuat dengan SVG/CSS sendiri. File referensi `Mandiri QRIS Nusantara Signage Collection.png` tidak tersedia dalam lampiran kerja ini; tidak ada klaim bahwa desain menyalinnya atau memakai logo QRIS/GPN/Mandiri resmi.
- Persetujuan pemrosesan wajib; izin dihubungi petugas terpisah dan opsional. Tanpa izin dihubungi, data kontak tidak menjadi prospek. Dengan izin, satu record `Prospect` existing dibuat pada cabang 11539 dengan deduplikasi UUID permintaan dan hash telepon+usaha+hari WIB, `FollowUp`, notifikasi PIC internal, dan audit. Mapping internal membedakan permintaan QRIS Custom dari penggunaan terverifikasi. Tidak ada email otomatis ke pengunjung.
- Token sesi desain hanya disimpan di memori browser; file privat di `PRIVATE_STORAGE_PATH/qris-custom-temp` berumur 24 jam dan dibersihkan worker tiap 15 menit setelah kedaluwarsa. Tombol **Hapus file sementara sekarang** tersedia. Worker harus hidup dan volume storage harus persisten/terbagi antara web-worker. Backup file QRIS sementara tidak diperlukan; **kebijakan retensi prospek yang menyetujui kontak masih memerlukan keputusan organisasi**.
- Rate limit publik disimpan PostgreSQL. Default `PUBLIC_RATE_LIMIT_TRUST_PROXY=false` memakai bucket jaringan global konservatif; untuk banyak pengguna, set `true` hanya di balik reverse proxy tepercaya yang membuang header `X-Forwarded-For` dari klien dan memasang IP nyata. `APP_URL` harus cocok dengan origin HTTPS internal; CORS lintas origin tidak diaktifkan. Tile peta dapat melihat IP dan area tampilan, tetapi tidak menerima nama/nomor HP melalui URL.

## Stack

Next.js App Router 16.3.8, React 19.2.8, TypeScript 5, Tailwind CSS 4, Route Handlers Node.js, PostgreSQL 16, Prisma 7.10.0, Better Auth 1.7.7, Zod 4.6.5, Leaflet 1.9.4, Nodemailer 10.0.13, Sharp 0.35.5, dan Vitest 5.0.3. Lockfile npm disertakan.

## Menjalankan lokal

Prasyarat: Node.js 22+, npm 10+, dan Docker Desktop/Engine dengan Compose.

```powershell
Copy-Item .env.example .env.local
# Ganti BETTER_AUTH_SECRET dengan nilai acak minimal 32 karakter.
docker compose up -d postgres
npm ci
npm run db:generate
npm run db:deploy
$env:BOOTSTRAP_ADMIN_NAME='Administrator MABES LINK'
$env:BOOTSTRAP_ADMIN_EMAIL='admin-internal@example.com'
$env:BOOTSTRAP_ADMIN_PASSWORD='ganti-password-kuat-minimal-14-karakter'
npm run bootstrap:admin
Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD
npm run dev:all
```

`npm install`/`npm ci` menjalankan `prisma generate` melalui `postinstall`, `npm run dev:web` mengulanginya sebelum Next.js berjalan, dan `npm run build` mengulanginya melalui `prebuild`. Ini mencegah development atau build memakai `@prisma/client` yang belum digenerate. Client Component tidak mengimpor runtime enum Prisma; validasi nilai tetap dilakukan kembali oleh Zod dan service server.

`npm run dev` (alias `npm run dev:all`) menjalankan web dan worker sebagai proses terpisah agar pengingat tidak terlewat saat pengembangan. Untuk inspeksi web saja gunakan `npm run dev:web`; bila memilih mode itu, jalankan `npm run worker` pada terminal lain. Worker wajib selalu hidup agar reminder tetap berjalan saat browser ditutup.

Halaman aplikasi menampilkan peringatan merah bila heartbeat worker tidak tersedia atau lebih lama dari 2,5 kali interval polling. Diagnosis satu janji tanpa menampilkan identitas nasabah:

```powershell
npm run diagnose:appointment -- <service-case-id>
```

Tidak ada seeder data bisnis atau kredensial demo di UI. `bootstrap:admin` hanya untuk ADMIN awal: perintah menolak menimpa email, menolak berjalan jika ADMIN operasional aktif sudah tersedia, dan tidak mencetak password. Setelah login, ADMIN mengelola akun melalui **Manajemen Pengguna**. Role hanya `ADMIN`, `CS`, `SUPERVISOR`, dan label UI `OUTBRANCH` (enum database stabil: `OUT_BRANCH`). Pembuatan referensi prospek manual nonaktif secara default (`ALLOW_MANUAL_REFERENCE_ENTRY=false`).

### Empat role untuk testing terisolasi

`seed:roles` tidak pernah berjalan saat build/start/migration. Gunakan hanya pada database terpisah yang namanya mengandung `test`:

```powershell
docker compose exec postgres createdb -U mabeslink mabeslink_test
# Atur DATABASE_PURPOSE=testing, TEST_DATABASE_NAME=mabeslink_test,
# ROLE_SEED_ENABLED=true, ROLE_SEED_CONFIRM=MABESLINK_TEST_ONLY di .env.local.
npm run db:deploy
npm run seed:roles
npm run start:test
# terminal lain
npm run test:roles
```

Seeder membuat tepat empat akun domain `.test`, memakai hash Better Auth, dan menulis password aktual/cakupan/login ke `role.md` lokal yang diabaikan Git. Run ulang tidak menimpa password. Penghapusan eksplisit: `npm run seed:roles:remove` dengan pengaman testing yang sama. Jangan mengarahkan perintah ini ke database operasional.

## Deployment internal dengan Compose

```powershell
Copy-Item .env.production.example .env.production
# Isi seluruh rahasia, URL HTTPS internal, sender, dan konfigurasi yang disetujui.
docker compose --env-file .env.production -f docker-compose.production.yml config
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

Compose menyediakan PostgreSQL tanpa port publik, migration one-shot, web dan worker dari image yang sama, health check, `restart: unless-stopped`, volume database, volume foto privat, dan volume backup. Reverse proxy internal harus menyediakan HTTPS. Jangan menaruh `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL`, atau secret auth pada variabel `NEXT_PUBLIC_*`.

Health web tersedia di `GET /api/health`; response membedakan database dan heartbeat worker. Health worker menggunakan `npm run worker:health`. Nilai `stale-or-not-started` berarti web/database hidup tetapi proses worker harus diperiksa.

## Worker, outbox, dan notifikasi

- Tick scheduler default setiap 60 detik (`WORKER_POLL_INTERVAL_MS`).
- Job persisten diklaim atomik dengan `FOR UPDATE SKIP LOCKED`, lease dua menit, dedup key unik, retry terbatas/backoff, dan recovery setelah restart.
- Worker memeriksa kembali versi jadwal, PIC, status pekerjaan, dan status janji sebelum membuat notifikasi/email. Janji `CONFIRMED` tetap mempunyai reminder 30 menit sebelum dan saat waktu janji. Reschedule, reassign, selesai, atau batal membatalkan reminder versi lama; jadwal baru membuat job versi baru.
- SMTP dilakukan di luar transaksi claim. Timeout/socket ambigu menjadi `UNKNOWN` dan tidak diretry otomatis; SMTP accepted bukan bukti pesan sampai inbox.
- SSE `/api/notifications/stream` membaca PostgreSQL setiap dua detik secara default, memakai cursor/`Last-Event-ID`, dan hanya mengirim record penerima login/cabangnya. UI memiliki polling cadangan lima detik.

## SMTP dan smoke test email

Alamat smoke test dikunci pada `sadamalrasyid1@gmail.com`. Script tidak membuat task/account dan tidak mengirim ke nasabah. Untuk jalur operasional tanpa email keluar, pertahankan `SMTP_DRY_RUN=true`; worker menyimpan status/preview sebagai `DRY_RUN`.

Pengiriman nyata hanya boleh dipicu secara eksplisit setelah kredensial resmi dan sender terverifikasi tersedia di environment server:

```powershell
$env:TEST_NOTIFICATION_EMAIL='sadamalrasyid1@gmail.com'
$env:EMAIL_ENABLED='true'
$env:SMTP_DRY_RUN='false'
npm run smoke:test-email
```

Script memastikan target merupakan akun internal operasional aktif yang mengizinkan email, memverifikasi koneksi/auth SMTP, recipient allowlist, kuota aplikasi, membatasi smoke test satu percobaan per hari WIB secara persisten, dan mengirim satu template aman. Tanpa opt-in/kredensial lengkap script berhenti sebelum pengiriman. Hasil membedakan `SMTP_ACCEPTED`, `FAILED`, `UNKNOWN`, atau `QUOTA_BLOCKED`; `SMTP_ACCEPTED` bukan bukti masuk inbox. TLS certificate verification tidak dinonaktifkan. Jalur reminder operasional tetap melalui outbox/worker dan menyimpan status/messageId. Brevo Free dan provider lain mempunyai kuota/persyaratan yang dapat berubah; periksa dokumentasi resmi [SMTP integration](https://developers.brevo.com/docs/smtp-integration), [pricing](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans), dan [sender authentication](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP). Biaya web, worker yang selalu berjalan, database, storage, backup, dan observability terpisah dari kuota SMTP.

Untuk Brevo, ambil SMTP key milik akun pengguna dari dashboard **SMTP & API**, lalu verifikasi sender/domain. `SMTP_PASS` bukan password login atau API key. Default repo adalah `smtp-relay.brevo.com:587`, login `bc7ba9001@smtp-brevo.com`, dan sender `MABES LINK <aturbabyincubator@gmail.com>`. Transport memakai `secure=false`, STARTTLS wajib, TLS minimum 1.2, dan verifikasi sertifikat tetap aktif. `SMTP_PASS` sengaja kosong; jangan aktifkan pengiriman bila SMTP key atau verifikasi sender belum valid.

## Peta, koordinat, dan foto privat

- Leaflet memakai tile URL/atribusi yang dapat dikonfigurasi. Ikuti [OpenStreetMap Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/), jangan bulk download, dan gunakan provider yang diizinkan organisasi.
- Overlay interaktif memakai referensi batas Kelurahan Mangga Besar dari [FeatureServer GIS Pemprov DKI](https://gis-dpmptsp.jakarta.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Kelurahan_DKI_Jakarta/FeatureServer/85), disederhanakan ke WGS84. Garis ini untuk filter/fokus peta dan bukan penetapan wilayah kerja cabang.
- Koordinat disimpan sebagai `numeric(10,7)`, wajib berpasangan, dan `0` valid. Sumber (`MAP_PIN`, `MANUAL_COORDINATES`, atau `DEVICE_GEOLOCATION`) serta waktu pencatatan disimpan pada record prospek yang sama. Posisi perangkat hanya sementara; [browser geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) memerlukan secure context/izin dan tidak membentuk riwayat GPS.
- Mapping menampilkan toko/usaha dengan `UsageVerification=VERIFIED` **serta** permintaan QRIS Custom yang memberi consent, dengan label berbeda agar permintaan tidak disalahartikan sebagai penggunaan. Semua akun login dapat menambah serta mengubah mapping dalam cabangnya; ADMIN dapat memilih PIC lintas cabang. Tombol **Tambah lokasi** untuk penggunaan terverifikasi membuat `Prospect` dan `UsageVerification` secara transaksional pada model existing, dengan referensi verifikasi internal dan audit. Marker memiliki ikon persisten toko/kuliner/belanja/kantor/kesehatan/jasa, palet warna yang dapat dipilih, ukuran yang dapat diskalakan, serta tombol **Fokus hasil filter**. Lokasi dapat dibuat/diubah/dikosongkan; foto dapat ditambah/diganti/dihapus.
- **Mapping Janji** (`/appointment-map`) menampilkan sebaran janji sesuai cakupan role/cabang dengan filter pencarian, status, PIC, waktu, dan ukuran marker. Pencarian lokasi pada form hanya mencari titik yang sudah tersimpan dan diizinkan; tidak ada scraping Google Maps atau pengiriman identitas ke geocoder publik.
- Kartu akuisisi dapat dihapus oleh pembuat, supervisor cabang, atau ADMIN melalui konfirmasi. Implementasinya soft-delete: kartu disembunyikan, status/reminder dibatalkan, dan audit tetap dipertahankan.
- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) location/direction hanya membawa koordinat dan tidak memakai API key. Jarak aplikasi adalah Haversine berlabel “Jarak garis lurus”, bukan jarak rute atau waktu tempuh.
- Foto tempat opsional disimpan di `PRIVATE_STORAGE_PATH` pada volume persisten di luar webroot, mengikuti prinsip [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). Maksimum default tiga gambar, 5 MB/gambar, JPEG/PNG/WebP. Server memeriksa isi/decode/dimensi, re-encode WebP, menghapus metadata, memakai nama acak, dan melayani file melalui endpoint berotorisasi.

## Alarm perangkat

Tombol lonceng membuka dropdown ringkas terlebih dahulu. Tombol **Lihat detail** pada sebuah item baru membuka modal detail; tersedia badge belum dibaca, status SSE/polling, tandai dibaca/semua dibaca, dan tautan internal. **Pengaturan Notifikasi** menyediakan **Aktifkan Suara**, **Tes Suara**, **Tes alarm waktu janji**, volume 0–100%, **Mute**, stop, pengulangan 1/3/5/10/20 kali, jenis reminder, dan aktivasi notifikasi sistem yang terpisah. Alarm tepat waktu janji memakai pola berbeda, lebih rapat, dan sedikitnya lima putaran; pengingat awal memakai pola normal. Pengguna dapat memilih file alarm MP3/WAV/OGG/M4A/WebM maksimal 5 MB dan 30 detik per putaran; file disimpan privat pada IndexedDB browser/perangkat tersebut, tidak dikirim ke server. Notifikasi baru juga memunculkan toast kecil di kanan atas. Saat aplikasi dibuka kembali, paling banyak satu alarm janji belum dibaca yang tersimpan dalam 15 menit terakhir dipulihkan setelah interaksi pengguna mengaktifkan audio; riwayat lama tidak dibunyikan ulang.

Prompt aktivasi audio tidak lagi muncul otomatis setelah login. Aktivasi dilakukan sadar dari **Pengaturan Notifikasi**: tombol hijau mengaktifkan suara dan tombol merah mematikannya. Penghapusan ringtone dan logout memakai dialog konfirmasi.

Web Audio dibuat/resume dari klik pengguna dan preferensi disimpan per user/perangkat. Aktivasi dilakukan dari tombol pengaturan—tidak ada prompt paksa setelah login—dan browser tetap memberi keputusan akhir kepada pengguna. Setelah pernah diaktifkan, aplikasi mencoba mempersenjatai kembali audio pada interaksi pertama setelah reload. Reminder janji terkonfirmasi dibuat pada T−30, T−25, T−20, T−15, T−10, T−5, dan T0, memakai kategori suara **Janji dan tindak lanjut**, serta tetap berbunyi pada jam senyap. Default volume perangkat baru adalah 100%; pilihan volume pengguna dan volume sistem tetap dihormati. Perubahan janji, status pekerjaan, mapping lokasi, dan foto menghasilkan notifikasi persisten kepada PIC yang berwenang. Operasi baca tidak dibunyikan agar membuka halaman tidak menghasilkan spam.

Chrome dan Edge diuji langsung di Windows. Opera berbasis Chromium diharapkan memakai API standar yang sama tetapi tidak tersedia pada mesin pemeriksaan. Safari belum diuji langsung; iOS/iPadOS mempunyai persyaratan Home Screen khusus untuk Web Push background. Implementasi saat ini adalah SSE/Web Audio selama aplikasi terbuka, bukan Web Push background. Alarm hanya dijanjikan selama MABES LINK terbuka; saat browser tertutup, sumber pengingat tetap worker/outbox dan email internal jika SMTP aktif.

Smoke alarm lokal menggunakan database testing, akun sementara yang dibersihkan otomatis, Edge terlihat, notifikasi persisten, dan SSE:

```powershell
npm run build
npm run start:test
# terminal lain; speaker laptop harus aktif
npm run smoke:test-alarm
```

Keberhasilan script membuktikan notifikasi diterima dan Web Audio dijadwalkan. Suara fisik speaker tetap perlu didengar pengguna karena software tidak dapat mengukur keluaran speaker laptop.

## Backup dan restore

Backup harus mencakup PostgreSQL **dan** volume foto karena database hanya menyimpan metadata/storage key. Format database menggunakan `pg_dump -Fc`/`pg_restore`; lihat [dokumentasi backup PostgreSQL](https://www.postgresql.org/docs/16/backup.html).

```powershell
.\scripts\backup.ps1 -Name backup-20261003
```

Script menghasilkan `backup-20261003.dump` dan `backup-20261003-uploads.tar.gz` pada host. Salin hasil ke media internal terenkripsi dan uji checksum/retensi sesuai kebijakan organisasi.

Restore bersifat destruktif terhadap database target dan memerlukan flag eksplisit:

```powershell
.\scripts\restore.ps1 -Name backup-20261003 -ConfirmRestore
npm run db:deploy
```

Lakukan restore hanya pada maintenance window, setelah backup target diverifikasi. Jalankan health check, migration status, uji login/otorisasi, dan pemeriksaan file sebelum membuka layanan. Script sudah divalidasi sintaksnya, tetapi drill restore penuh belum dilakukan pada pemeriksaan terakhir.

## Pemeriksaan

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
npx prisma migrate status
npm run test:visual
npm run test:qris-visual
npm run test:roles
```

Tes integrasi memerlukan PostgreSQL lokal yang sudah dimigrasi, membuat fixture terisolasi sendiri, lalu membersihkannya. Tidak memerlukan seed. Hasil aktual dan keterbatasan ada di [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

`test:qris-visual` memerlukan `npm run start:test` pada terminal lain serta database `mabeslink_test` yang telah menerima migration. Tes memakai QR samaran dan **tidak** menciptakan prospek karena consent kontak dimatikan. `scripts/qris-api-smoke.ts` dapat dijalankan terhadap server testing yang sama dengan `DATABASE_PURPOSE=testing`; script membuat lalu menghapus sesi QR uji dan memeriksa respons PNG/PDF lewat HTTP.

```powershell
$env:DATABASE_PURPOSE='testing'
$env:TEST_DATABASE_NAME='mabeslink_test'
npx tsx scripts/qris-api-smoke.ts
```
