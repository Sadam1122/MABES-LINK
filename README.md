# MABES LINK

> **Alarm waktu janji:** pengingat sebelum janji dan alarm saat waktu janji tiba
> sama-sama membuka modal dan suara sesuai aktivasi/mute/volume browser.
> Ingatkan lagi 1/5/10 menit membuat alarm baru melalui worker; untuk alarm saat
> janji, snooze dibatasi sampai 1 jam setelah jadwal. Extend waktu janji membatalkan
> versi lama dan menjadwalkan ulang. Restart web dan worker setelah pembaruan;
> worker menambahkan alarm T0 mendatang ke janji existing tanpa mengubah akun/data.
> Tick worker default 60 detik + SSE 2 detik, bukan jaminan bunyi tepat di detik nol.

> **Countdown kartu & suara khusus alarm:** kartu di Akuisisi Nasabah menunjukkan
> Alarm berikutnya dan Menuju janji dari jadwal PostgreSQL. Terima pekerjaan lebih
> dahulu untuk mengaktifkan pengingat. Simpan/edit/hapus dan perubahan lain hanya
> menampilkan notifikasi visual, tanpa suara, termasuk pada perangkat dengan
> preferensi lama. Suara otomatis hanya saat modal Alarm janji muncul.
> Countdown bukan pemicu audio; worker harus berjalan dan browser tetap perlu
> aktivasi suara. Detail hasil terbaru di IMPLEMENTATION_STATUS.md.

> **Pembaruan terbaru, 8 Oktober 2026:** modal **Alarm janji** berisi detail jadwal,
> **Matikan alarm** dan **Ingatkan lagi 1/5/10 menit**. Snooze tersimpan PostgreSQL
> dan diproses worker; berlaku per penerima, termasuk semua pendamping terpilih.
> Satu sumber audio berulang maksimal 2 menit, mengikuti mute/volume, tidak ganda
> antar-tab. Aktivasi browser tetap memerlukan interaksi. **Product Holding** di
> Mapping memakai checklist 38 produk/kanal dan pencarian; penawaran tetap dibatasi
> izin internal. Migration additive `20261008140000_alarm_snooze` tidak mereset data.
> Jalankan `npm run db:deploy`, `npm run db:generate`, `npm run build`, lalu restart
> web (`npm run start`) dan worker terpisah (`npm run worker`); untuk dev gunakan
> `npm run dev`. Panduan: [Janji & pengingat](./docs/appointment-reminders.md).
> Hasil terbaru: **104 tes lulus, 2 skip**, **72 pemeriksaan browser lulus**,
> typecheck/lint/build lulus; [Guidebook terbaru, 33 halaman](./docs/MABES_LINK_Guidebook_2026-10-08.pdf).
> Detail pembuktian dan batas browser/PDF di
> [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

> **Tracking janji, 8 Oktober 2026:** titik KCP diperbarui menjadi
> `-6.14621,106.82421` sesuai konfirmasi pengelola. Konfigurasi lokal `.env`
> sudah diisi tanpa mengaktifkan SMTP. Restart web **dan worker** agar nilai baru
> digunakan. **Terima pekerjaan** mengonfirmasi waktu tercatat dan mengaktifkan
> pengingat mendatang; countdown janji/alarm membaca job PostgreSQL, bukan
> scheduler browser. Readiness layanan tidak ditampilkan pada detail janji
> akuisisi. **Janji terlaksana** tidak mengubah layanan atau penggunaan produk.

> **Pembaruan janji/pengingat 8 Oktober 2026:** gunakan satu **Waktu janji (WIB)**,
> kendali otomatis pada pembuat, pendamping opsional, pengingat T−24 jam dan
> T−15 menit/T−1 jam berdasarkan jarak terverifikasi. Aturan ini menggantikan
> pengulangan T−30…T0 yang dijelaskan dalam catatan historis.
> Panduan konfigurasi dan batas browser: [Janji & pengingat](./docs/appointment-reminders.md).
> Hasil sebelum pembaruan modal/snooze: **79 tes regresi lulus, 2 skip** (workbook lama tidak tersedia),
> **45 pemeriksaan browser lulus**, typecheck/lint/build lulus.

> **Audit sebelumnya, 8 Oktober 2026:** build, typecheck, lint, 69 tes regresi, serta pemeriksaan
> browser pada 360/390/768/1440 px telah dijalankan. Dua tes workbook lama dilewati
> karena file sumber tidak tersedia. Hasil terbaru dan batas pembuktian ada di
> [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md). Panduan dari screenshot
> aktual: [Guidebook PDF](./docs/MABES_LINK_Guidebook_2026-10-08.pdf).
> Audit ini tidak melakukan reset, impor ulang, atau perubahan akun operasional.

> **Status saat ini, 7 Oktober 2026:** atas konfirmasi pengguna, hanya **42
> record Mapping lama** pada database lokal yang diganti dengan 117 lokasi dari
> `MABES_LINK_Mapping_Mangga_Besar_2026-10-07.xlsx`. Dua akun dan record
> autentikasinya tetap ada; janji, kasus, dan data lain tidak di-reset. Backup
> sebelum penggantian ada di
> `.data/backups/before-replace-only-mapping-20261007-145332.dump`.
> Semua koordinat workbook bertanda **belum diverifikasi di lapangan**.

Aplikasi operasional internal KCP Mandiri Jakarta Mangga Besar (`11539`, `B.2`) untuk menghubungkan pekerjaan in-branch dan out-branch sampai layanan ditangani, diverifikasi, ditutup, dan penggunaan produk dicatat terpisah.

Implementasi ini disiapkan untuk deployment internal, tetapi **belum dinyatakan production-ready** sebelum approval keamanan/infrastruktur, verifikasi proses CAKRA, uji backup/restore, dan uji SMTP organisasi selesai. Jangan deploy ke internet publik atau memasukkan data nyata bank ke lingkungan development/test.

Halaman awal dan `/qris-custom` dapat dibuka tanpa login **pada host yang diizinkan**. Route internal, prospek, mapping, reminder, dan dashboard tetap memerlukan sesi serta pemeriksaan role/cabang di server. Compose production mengikat web ke loopback `127.0.0.1:3000`; akses pengguna memerlukan reverse proxy HTTPS internal dan persetujuan keamanan sebelum diaktifkan.

## Beranda, banner, dan Mapping workbook 2026

Beranda memakai `public/Gambar/logo.png`; logo login dapat diklik untuk kembali ke
beranda, sedangkan logo dalam area kerja menuju dashboard. Footer memakai aset
Mandiri, Livin', Kopra, Livin' Merchant, dan Danantara yang tersedia. Alamat
cabang ditampilkan bersama peta interaktif dan tautan Google Maps. Untuk iframe
Google, isi **salah satu**: `GOOGLE_MAPS_EMBED_URL` dengan nilai `src` dari Google
Maps → Bagikan → Sematkan peta (URL `https://www.google.com/maps/embed?pb=…`, bukan
HTML iframe), atau `GOOGLE_MAPS_EMBED_KEY` untuk Maps Embed API. URL sematan yang
valid diprioritaskan. Tambahkan ke `.env.local` saat lokal, atau env file web saat
deployment internal, lalu restart web. Jangan menebak key atau memakai key milik
situs lain. Tanpa keduanya, tampil **Leaflet/OpenStreetMap** dengan titik cabang,
bukan Google Maps; tautan rating/ulasan tetap menuju listing Google. Angka rating
tidak disalin/dikarang dan tidak ada scraping/review API.
Embed API memerlukan key, billing, dan pembatasan HTTP referrer
menurut [dokumentasi Google](https://developers.google.com/maps/documentation/embed/quickstart).
Jangan memasukkan data prospek ke URL peta publik.

Pembaruan UI: peta Mapping lebih lebar (panel daftar desktop 290–310 px), tinggi
peta responsif 480–760 px, tombol **Perbesar peta** menyembunyikan daftar sementara,
dan daftar mempunyai scroll sendiri. Peta berpusat pada penanda logo Mandiri;
**Fokus cabang**, **Fokus Mangga Besar**, dan **Fokus hasil filter** berbeda fungsi.
Titik cabang `-6.14621,106.82421` sesuai konfirmasi pengelola aplikasi pada
8 Oktober 2026, bukan klaim survei resmi bank. Batas administratif tetap terpisah.
Heatmap memakai pane Leaflet, redraw saat geser/resize, warna bergradasi, dan
tidak menutupi popup. Home memakai animasi scroll satu kali, menghormati reduced
motion, dan carousel informasi dengan tombol jeda/prev/next serta pilihan kelompok
produk: Livin’, Kopra, Livin’ Merchant, simpanan, pinjaman, kartu, investasi, asuransi,
bisnis dan Prioritas. Pita kuning besar memenuhi latar banner dengan opacity 10%,
di belakang teks dan kontrol. Tombol **Jelajahi seluruh produk Mandiri** menuju
katalog/sitemap resmi; aplikasi tidak mengklaim menyalin seluruh katalog atau
memberi diskon/persetujuan otomatis untuk semua produk. Banner HUT ke-28
hanya muncul selama Oktober 2026 dan menautkan
[kanal resmi Mandiri](https://www.bankmandiri.co.id/en/hut-mandiri-28);
tidak ada klaim besaran diskon atau materi eksternal yang diunduh otomatis.
Perubahan UI ini sudah diperiksa ulang pada audit 8 Oktober 2026 menggunakan
production build lokal dan data samaran. Tidak ada perubahan pada workbook,
koordinat, akun, maupun penugasan operasional dalam audit tersebut.

Petugas login cabang 11539 dapat mengunggah banner promosi berjudul melalui
dashboard. Panduan ukuran: **1600×600 px**, landscape rasio 1,6:1–4:1, minimal
800×280 px, JPEG/PNG/WebP hingga 5 MB, maksimal 6 banner aktif. Gambar didekode,
di-resize/re-encode WebP tanpa metadata EXIF, disimpan pada
`PRIVATE_STORAGE_PATH/home-banners`, dan disajikan lewat endpoint gambar publik
karena banner memang materi beranda publik. Unggahan/penghapusan diaudit; pembuat,
SUPERVISOR, atau ADMIN boleh menghapus sesuai izin. Gunakan materi yang sudah
disetujui organisasi, tanpa identitas nasabah atau promosi yang belum disahkan.
Volume storage harus persisten dan dibagi web–worker. Backup database saja tidak
memulihkan file banner; backup volume privat juga diperlukan.

Workbook baru memakai 14 kolom `Mapping` yang sudah didukung aplikasi. Parser
sekarang dapat membaca SpreadsheetML berprefiks `x:` dengan normalisasi sementara
di memori; file sumber tidak diubah. Sheet `Mapping` saja yang menjadi record
prospek. Sheet kontak publik, omzet, dan CIF **tidak** masuk database Mapping.
Kode internal dari workbook dipertahankan. Koordinat dari workbook tampil sebagai
pin dengan label `WORKBOOK_UNVERIFIED` sampai petugas memeriksa lokasi; catatan
pendamping workbook menyebut banyak titik belum dicocokkan ke pin Google Maps.
Produk/kebutuhan pada workbook tetap petunjuk awal, bukan kebutuhan terkonfirmasi
atau penggunaan terverifikasi. Ada 35 nama yang cocok dengan 42 lokasi lama,
namun kode internal berbeda; seed baru menolak impor ganda begitu saja.

Seeder lama khusus workbook 42 baris telah dihapus dari package scripts. Seeder
baru hanya menerima workbook dengan SHA-256 yang sudah diperiksa, tepat 117 baris,
database lokal `mabeslink`, dan PIC aktif yang cocok. Ia **tidak membuat atau
mengubah akun**, tidak mengirim email, dan idempotent setelah berhasil. Mode
penggantian 42 lokasi lama menolak record yang telah berubah atau memiliki
visit, follow-up, handover, kasus, foto, peluang, maupun verifikasi penggunaan.
Mode penggantian lama telah dijalankan satu kali setelah backup diverifikasi.
Jangan gunakan reset penuh untuk mengulangnya. File workbook berasal dari
pengguna dan tidak disalin ke source code atau database testing.

```powershell
npm run compose:db
npm ci
npm run db:deploy
npm run db:generate
npm run mapping:workbook-check
npm run mapping:seed-preview   # tidak menulis database
npm run dev                    # web + worker
```

`mapping:seed-replace-prior` sudah berhasil mengganti 42 lokasi lama secara
transaksional. `npm run mapping:seed-verify` memeriksa 117 kode, 117 discovery,
label sumber koordinat, dan visibilitas OUTBRANCH. Pratinjau ulang mengenali
seed yang sama dan tidak membuat duplikat. `mapping:seed-commit` hanya untuk
instalasi lokal yang belum punya prospek; jangan menjalankan reset database.

Google Maps URL untuk lokasi/navigasi bekerja tanpa API key. Iframe Google Maps
di beranda memerlukan `GOOGLE_MAPS_EMBED_KEY` yang valid; key tidak ada pada
konfigurasi lokal, sehingga `.env.local` tidak diisi dengan nilai tebakan.
Jika organisasi menyediakan key yang mengaktifkan Maps Embed API dengan billing
dan pembatasan referrer, isi `GOOGLE_MAPS_EMBED_KEY="..."` di `.env.local` atau
environment server internal. Key Embed terlihat pada URL iframe; jangan
memakainya sebagai rahasia tak-terungkap. Tanpa key, tombol Google Maps dan
peta Leaflet/OpenStreetMap internal tetap tersedia. `LOCATION_SEARCH_URL`
terpisah dan hanya untuk provider pencarian alamat yang diizinkan.

## Batas fungsi

- `ServiceCase` adalah alur kerja tunggal: dibuat → ditugaskan → diterima PIC → diproses → selesai ditangani → diverifikasi → ditutup. Menunggu nasabah/sistem, eskalasi, batal, dan reopen tersedia sebagai cabang tervalidasi.
- Menu **Akuisisi Nasabah** membuat janji langsung tanpa meminta referensi CAKRA: isi orang yang ditemui, nama toko/usaha opsional, alasan, satu atau beberapa PIC internal, waktu WIB, titik peta/GPS/koordinat manual, label lokasi, dan foto tempat opsional. Server membuat kode dan referensi kerja lokal pada model `Prospect` yang sama dalam satu transaksi. Ini tidak diklaim sebagai master lead atau integrasi CAKRA.
- Status janji `NEEDS_SCHEDULING` tidak dianggap sebagai janji terkonfirmasi. Email hanya mengingatkan PIC internal untuk membuat atau mengonfirmasi janji; aplikasi tidak mengirim undangan otomatis kepada calon nasabah.
- Penyelesaian layanan tidak otomatis menjadi `UsageVerification`.
- OTP nomor lama, face recognition, blokir/aktivasi, dan pengecualian CSM/Livin tetap mengikuti prosedur resmi; tidak ada bypass.
- Tidak ada integrasi/scraping CAKRA, Kopra, core banking, geocoding Google, AI berbayar, WhatsApp blast, atau keputusan kredit otomatis. Google Maps URLs hanya membuka pencarian/navigasi; iframe Embed opsional memerlukan key resmi.
- Audit non-duplikasi dan keputusan yang belum terverifikasi ada di [CAKRA_NON_DUPLICATION.md](./CAKRA_NON_DUPLICATION.md).

## QRIS Custom dan katalog akuisisi

Editor publik memakai dua PNG asli di `public/qris-template/`: **Batik Nusantara** dan **Alam Indonesia** (1064x1478 px). QR resmi dikomposit di **belakang** template, dengan zoom 70-140% dan geser yang dibatasi ruang tengah; hasil harus lolos pemeriksaan scan. Tulisan bawah dapat diatur gaya huruf, ukuran, ketebalan, dan warnanya. Ada 20 stiker vektor, maksimal 3 stiker per desain yang dapat diseret di panel bawah, serta unggah JPG/PNG/WebP sendiri (64-2000 px per sisi, maksimal 320 KB per stiker). Server memvalidasi, mengecilkan dan menghapus metadata stiker. Pratinjau memakai render yang sama dengan unduhan PNG. Istilah promosi adalah **bingkai/desain QRIS gratis**, bukan benda cetak gratis. Paragraf di bawah tentang template SVG lama berlaku untuk renderer kompatibilitas, bukan pilihan publik saat ini.

Menu **Pendaftar QRIS** tersedia untuk ADMIN (seluruh cabang) dan OUTBRANCH (cabang sendiri) setelah login. Hanya data pendaftar yang menyetujui untuk dihubungi masuk daftar; template terakhir yang berhasil dipratinjau disimpan ke `Prospect` existing. Jalankan migrasi non-destruktif `npx prisma migrate deploy` sebelum web/worker memakai versi ini.

Jika log menampilkan `Unknown argument publicRequestId`, proses web masih memakai Prisma Client lama. Hentikan proses web/worker (`Ctrl+C`) dan jalankan ulang `npm run dev`. Perintah dev sekarang menjalankan `prisma migrate deploy` dan `prisma generate` sebelum memulai keduanya. Refresh browser saja tidak mengganti client yang sudah dimuat di proses Node. Jangan menghapus database atau folder data untuk memperbaikinya.

- `/work` memakai katalog 9 kategori produk/layanan dengan pilihan bertingkat dan pencarian produk. Status akuisisi, target/realisasi beserta satuan, PIC, jadwal, next action, CIF/nomor rekening/HP opsional disimpan pada `ServiceCase` existing; data sensitif opsional hanya terlihat pada halaman internal yang berwenang. Label katalog perlu validasi pemilik produk sebelum dipakai untuk data nyata.
- `/qris-custom` beralur informasi usaha → unggah QRIS resmi → pilih template → kustomisasi → validasi/unduh. Ini editor tampilan, **bukan** penerbitan atau verifikasi resmi QRIS/merchant. Pengguna harus memakai QRIS yang diterbitkan melalui proses resmi dan menguji scan sebelum cetak.
- File JPG/PNG/PDF satu halaman maksimal 8 MB diperiksa signature, decode, dimensi, dan QR yang dapat dibaca. Sumber disimpan privat sementara; layer sumber ditaruh utuh dalam area putih terkunci, tanpa overlay dekorasi. Hasil PNG/JPG/PDF A5/A6 dihasilkan server; QR didecode ulang dan dibandingkan dengan sumber sebelum dikirim. Re-encode/rasterisasi dapat mengubah byte gambar dan tidak menjamin seluruh teks resmi terbaca setelah cetak—periksa hasil fisik.
- Logo usaha JPG/PNG/WebP opsional maksimal 512 KB hanya muncul di luar area terkunci; warna, pola, bingkai, ornamen, ukuran, hemat tinta, undo/redo, dan berbagi file melalui Web Share tersedia. Template dibuat dengan SVG/CSS sendiri. File referensi `Mandiri QRIS Nusantara Signage Collection.png` tidak tersedia dalam lampiran kerja ini; tidak ada klaim bahwa desain menyalinnya atau memakai logo QRIS/GPN/Mandiri resmi.
- Persetujuan pemrosesan wajib; izin dihubungi petugas terpisah dan opsional. Tanpa izin dihubungi, data kontak tidak menjadi prospek. Dengan izin, satu record `Prospect` existing dibuat pada cabang 11539 dengan deduplikasi UUID permintaan dan hash telepon+usaha+hari WIB, `FollowUp`, notifikasi PIC internal, dan audit. Mapping internal membedakan permintaan QRIS Custom dari penggunaan terverifikasi. Tidak ada email otomatis ke pengunjung.
- Token sesi desain hanya disimpan di memori browser; file privat di `PRIVATE_STORAGE_PATH/qris-custom-temp` berumur 24 jam dan dibersihkan worker tiap 15 menit setelah kedaluwarsa. Tombol **Hapus file sementara sekarang** tersedia. Worker harus hidup dan volume storage harus persisten/terbagi antara web-worker. Backup file QRIS sementara tidak diperlukan; **kebijakan retensi prospek yang menyetujui kontak masih memerlukan keputusan organisasi**.
- Rate limit publik disimpan PostgreSQL. Default `PUBLIC_RATE_LIMIT_TRUST_PROXY=false` memakai bucket jaringan global konservatif; untuk banyak pengguna, set `true` hanya di balik reverse proxy tepercaya yang membuang header `X-Forwarded-For` dari klien dan memasang IP nyata. `APP_URL` harus cocok dengan origin HTTPS internal; CORS lintas origin tidak diaktifkan. Tile peta dapat melihat IP dan area tampilan, tetapi tidak menerima nama/nomor HP melalui URL.

## Stack

Next.js App Router 16.3.8, React 19.2.8, TypeScript 5, Tailwind CSS 4, Route Handlers Node.js, PostgreSQL 16, Prisma 7.10.0, Better Auth 1.7.7, Zod 4.6.5, Leaflet 1.9.4, Nodemailer 10.0.13, Sharp 0.35.5, dan Vitest 5.0.3. Lockfile npm disertakan.

## Excel untuk Mapping

Di `/mapping`, tombol **Template Excel**, **Ekspor Excel**, dan **Impor Excel** tersedia setelah login. Template XLSX memiliki sheet `Mapping`, `Petunjuk`, `Contoh`, dan `Pilihan Ikon`. Sheet `Contoh` berisi satu usaha samaran yang sudah diisi; **hanya sheet `Mapping` yang dibaca saat impor**. Header hijau berarti wajib, biru opsional, dan kuning kondisional. Untuk lokasi baru, `nama_usaha` selalu wajib. Latitude dan longitude opsional, tetapi harus diisi berpasangan bila diketahui; tanpa keduanya lokasi masuk daftar mapping tanpa pin dan bisa diberi koordinat nanti. Kode cabang otomatis dari akun non-ADMIN; PIC otomatis akun pengimpor jika berada pada cabang lokasi. ADMIN lintas cabang harus mengisi kode cabang dan email PIC aktif. Kolom lain seperti label, area/blok, sektor, petunjuk, kebutuhan produk (pisahkan dengan `;`), kebutuhan, dan ikon opsional. Sheet `Pilihan Ikon` memberi kode, nama, dan contoh visual untuk 26 ikon; contoh visual membantu memilih, bukan bentuk persis marker aplikasi. Koordinat `0,0` valid, tetapi jangan memakainya sebagai pengganti lokasi yang belum diketahui.

Untuk memperbarui lokasi existing, mulai dari **Ekspor Excel** lalu pertahankan `kode_internal` dan `versi` dari baris tersebut. Kolom opsional kosong pada update mempertahankan nilai lama; koordinat boleh dibiarkan kosong untuk mempertahankan titik lama. PIC existing tidak dapat diganti melalui Excel agar follow-up/penugasan terkait tidak terpisah; gunakan alur penugasan aplikasi. Impor pertama-tama menampilkan pratinjau tambah/perbarui, kesalahan bernomor baris, dan penanda otomatis jika titik di luar referensi batas Mangga Besar (bukan penetapan wilayah kerja). Seluruh file disimpan atomik hanya setelah konfirmasi. Baris duplikat, versi kedaluwarsa, PIC/cabang di luar akses, formula, hyperlink, koordinat invalid, dan template yang berubah ditolak. Batas impor 250 baris/1,5 MB per file. Ekspor mencakup seluruh data mapping dalam cakupan role/cabang hingga 5.000 record; halaman peta menampilkan 1.000 record terbaru dan menyatakan totalnya. Ekspor diaudit.

Lokasi baru dari Excel dibuat pada `Prospect` existing dengan penanda impor, **tanpa `UsageVerification`**. Ini bukan bukti produk Mandiri telah dipakai. Penggunaan harus tetap diverifikasi lewat alur resmi. File XLSX tidak disimpan di server setelah request; hanya record lokasi yang lolos validasi tersimpan. Jangan memasukkan CIF, nomor rekening/telepon, saldo, dokumen, atau informasi rahasia ke spreadsheet. Terapkan kontrol akses perangkat dan kebijakan penyimpanan file ekspor organisasi. Deployment perlu menerapkan migration `20261006160000_mapping_excel_import` dengan `npm run db:deploy` sebelum web/worker versi baru dimulai.

## Menjalankan lokal

Prasyarat: Node.js 22+, npm 10+, dan Docker Desktop/Engine dengan Compose.

```powershell
Copy-Item .env.example .env.local
# Instalasi baru saja: isi DATABASE_URL, POSTGRES_* dan secret auth valid.
# Repo existing: jangan menimpa .env/.env.local atau membuat ulang akun.
npm run compose:db
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

`compose:db`, `compose:check`, `compose:build`, dan `compose:up` membaca konfigurasi
lokal existing tanpa mencetak/menulis secret. Helper hanya menerima DSN PostgreSQL
loopback port 5434, mempertahankan volume database, dan menolak POSTGRES_* yang
berbeda dari DSN. Compose memakai DSN terpisah `DATABASE_URL_DOCKER` dengan host
`postgres:5432`; localhost di dalam container **bukan** database host.
`npm run compose:up` menjalankan FE+BE dalam web Next.js/Route Handlers, migration
one-shot, worker Node terpisah, serta database. Jangan menjalankannya saat port
3000 sudah dipakai web lain. Tidak ada backend kedua atau pengganti backend oleh
PostgreSQL. Hanya DB yang diperlukan untuk web/worker pada host: `compose:db`.
Build/start tanpa Docker: `npm run build`, lalu `npm start` dan `npm run worker`
pada dua terminal. `npm start` mengikat localhost; akses pengguna harus melalui
reverse proxy HTTPS internal yang diizinkan.

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
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

Compose menyediakan PostgreSQL tanpa port publik, migration one-shot, web dan worker dari image yang sama, health check, `restart: unless-stopped`, volume database, volume foto privat, dan volume backup. Reverse proxy internal harus menyediakan HTTPS. Jangan menaruh `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL`, atau secret auth pada variabel `NEXT_PUBLIC_*`.

Health web tersedia di `GET /api/health`; response membedakan database dan heartbeat worker. Health worker menggunakan `npm run worker:health`. Nilai `stale-or-not-started` berarti web/database hidup tetapi proses worker harus diperiksa.

Variabel wajib: `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`APP_URL`, `BETTER_AUTH_URL`, dan `BETTER_AUTH_SECRET` acak minimal 32 karakter.
Untuk image lokal juga isi/derive `DATABASE_URL_DOCKER`. Password pada DSN harus
URL-encoded. `PRIVATE_STORAGE_PATH` wajib volume persisten; web dan worker berbagi
volume. SMTP default tetap nonaktif/dry-run; baru isi SMTP_HOST/PORT/USER/PASS/FROM
dan batas kuota bila sudah disetujui. Konfigurasi `NEXT_PUBLIC_MAP_*` masuk saat
**build**, bukan rahasia dan bukan konfigurasi runtime; build ulang bila berubah.
Jangan memakai `docker compose down -v`, reset Prisma, atau mengganti nama volume
database existing. Compose tidak memasang reverse proxy/TLS atau memverifikasi
otorisasi organisasi secara otomatis. Akses SSH/jaringan, firewall, secret manager,
retensi backup, monitoring worker dan alerting tetap tanggung jawab hosting internal.

## Worker, outbox, dan notifikasi

- Tick scheduler default setiap 60 detik (`WORKER_POLL_INTERVAL_MS`).
- Job persisten diklaim atomik dengan `FOR UPDATE SKIP LOCKED`, lease dua menit, dedup key unik, retry terbatas/backoff, dan recovery setelah restart.
- Worker memeriksa kembali versi jadwal, kendali/pendamping, status pekerjaan, kedaluwarsa pengingat, dan status janji sebelum notifikasi/email. Janji `CONFIRMED` mempunyai pengingat 24 jam sebelumnya, lalu 15 menit untuk jarak terverifikasi ≤1 km atau 1 jam untuk >1 km/lokasi belum terverifikasi, serta alarm T0 saat waktu janji tiba. Slot yang kedaluwarsa tidak dikejar. Reschedule, pengambilalihan, selesai, atau batal membatalkan versi lama; tidak ada pengulangan otomatis tiap 5 menit. Snooze eksplisit diproses sebagai job baru.
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

- Favicon `app/favicon.ico` dan ikon PNG dibuat dari bentuk monogram MABES LINK oleh `npx tsx scripts/make-favicon.ts`; keduanya sudah masuk repo sehingga perintah ini hanya diperlukan bila desain ikon diubah.
- QRIS Custom memiliki pencarian nama tempat/alamat publik melalui `GET /api/location-search` dengan `LOCATION_SEARCH_URL` server-only. Pencarian otomatis menunggu 500 ms setelah ketikan berhenti; permintaan lama dibatalkan. Isi URL endpoint **Photon-compatible yang di-host sendiri atau secara eksplisit diizinkan organisasi** (misalnya `https://geocoder.internal.example/api`). Default kosong: pencarian internal menjelaskan bahwa penyedia belum tersedia; tombol Google Maps membuka pencarian terpisah, dan pin/koordinat manual tetap berfungsi. Jangan isi URL demo Photon atau Nominatim publik untuk aplikasi operasional: lihat [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) dan [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md). Jangan masukkan identitas/nomor pribadi dalam kueri. Tidak ada API key Google Maps atau scraping; hasil tempat baru tersimpan setelah dipilih pengguna.
- Mapping menyediakan mode **Penanda** dan **Heatmap** (semua titik, penggunaan terverifikasi, atau perlu tindakan). Heatmap dihitung lokal dari titik yang sudah lolos filter dan izin halaman, tanpa mengirim data tambahan ke provider peta. Halaman saat ini memuat maksimal 1.000 lokasi terbaru; kepadatan bukan gambaran seluruh cabang, skor kredit, atau perkiraan potensi dana.

- Leaflet memakai tile URL/atribusi yang dapat dikonfigurasi. Ikuti [OpenStreetMap Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/), jangan bulk download, dan gunakan provider yang diizinkan organisasi.
- Overlay interaktif memakai referensi batas Kelurahan Mangga Besar dari [FeatureServer GIS Pemprov DKI](https://gis-dpmptsp.jakarta.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Kelurahan_DKI_Jakarta/FeatureServer/85), disederhanakan ke WGS84. Garis ini untuk filter/fokus peta dan bukan penetapan wilayah kerja cabang.
- Koordinat disimpan sebagai `numeric(10,7)`, wajib berpasangan, dan `0` valid. Sumber (`MAP_PIN`, `MANUAL_COORDINATES`, atau `DEVICE_GEOLOCATION`) serta waktu pencatatan disimpan pada record prospek yang sama. Posisi perangkat hanya sementara; [browser geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition) memerlukan secure context/izin dan tidak membentuk riwayat GPS.
- Mapping menampilkan prospek lokasi, permintaan QRIS Custom yang memberi consent, dan penggunaan `UsageVerification=VERIFIED` dengan label berbeda. Semua akun login dapat menambah mapping dalam cabangnya; ADMIN dapat memilih PIC lintas cabang. **Tambah lokasi** sekarang membuat `Prospect` dan `MappingDiscovery` pada model existing, dengan kebutuhan default **Belum dikonfirmasi**, koordinat opsional, dan **tanpa** otomatis membuat `UsageVerification`; verifikasi penggunaan tetap alur terpisah. Marker memiliki 26 ikon persisten, filter, palet warna, dan skala. Heatmap dihitung hanya dari titik terlihat, bukan skor kredit atau potensi dana. Lokasi dan foto privat dapat dikelola sesuai izin.
- **Mapping Janji** (`/appointment-map`) menampilkan sebaran janji sesuai cakupan role/cabang dengan filter pencarian, status, PIC, waktu, dan ukuran marker. Modal **Buat janji** dapat memilih 26 ikon pada `Prospect.mappingMarkerIcon`; ikon tampil di peta janji dan tetap bisa diubah dari Mapping jika record memenuhi cakupan mapping. Pencarian produk/titik tersimpan memakai debounce 220/260 ms, label kolom tetap terlihat, dan API menampilkan kesalahan validasi per field (misalnya nomor HP), bukan hanya pesan umum. Pencarian lokasi pada form hanya mencari titik yang sudah tersimpan dan diizinkan; tidak ada scraping Google Maps atau pengiriman identitas ke geocoder publik.
- Kartu akuisisi dapat dihapus oleh pembuat, supervisor cabang, atau ADMIN melalui konfirmasi. Implementasinya soft-delete: kartu disembunyikan, status/reminder dibatalkan, dan audit tetap dipertahankan.
- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) location/direction hanya membawa koordinat dan tidak memakai API key. Jarak aplikasi adalah Haversine berlabel “Jarak garis lurus”, bukan jarak rute atau waktu tempuh.
- Foto tempat opsional disimpan di `PRIVATE_STORAGE_PATH` pada volume persisten di luar webroot, mengikuti prinsip [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). Maksimum default tiga gambar, 5 MB/gambar, JPEG/PNG/WebP. Server memeriksa isi/decode/dimensi, re-encode WebP, menghapus metadata, memakai nama acak, dan melayani file melalui endpoint berotorisasi.

## Alarm perangkat

Tombol lonceng membuka dropdown terlebih dahulu; **Lihat detail** membuka modal. Pengaturan menyediakan aktivasi suara, tes, volume 0–100%, mute dan izin notifikasi sistem yang terpisah. Setiap pengingat janji memainkan satu putaran saja. Pengulangan 1/3/5/10/20 hanya untuk pembaruan umum. Ringtone MP3/WAV/OGG/M4A/WebM maksimal 5 MB dan 30 detik tetap lokal di IndexedDB. Notifikasi baru memunculkan toast kanan atas. Klaim audio/pop-up atomik tersimpan di PostgreSQL per penerima, sehingga refresh/reconnect/tab lain tidak mengulangnya. Pengingat yang lewat toleransi 90 detik tidak dipulihkan atau dibunyikan terlambat.

Prompt aktivasi audio tidak lagi muncul otomatis setelah login. Aktivasi dilakukan sadar dari **Pengaturan Notifikasi**: tombol hijau mengaktifkan suara dan tombol merah mematikannya. Penghapusan ringtone dan logout memakai dialog konfirmasi.

Web Audio dibuat/resume dari klik pengguna, bukan izin paksa. Setelah reload aplikasi mencoba mengaktifkan kembali suara pada interaksi pertama jika sebelumnya diaktifkan. Pengingat janji terkonfirmasi T−24 jam dan T−15 menit/T−1 jam memakai kategori **Janji dan tindak lanjut** dan tidak digeser quiet hours; mute, pilihan volume dan volume sistem tetap dihormati. Default volume baru 100%. Preferensi mute/volume tersinkron antar-tab. Membaca halaman tidak membuat notifikasi baru. Ini at-most-once attempt, bukan jaminan suara terdengar jika tab mati, browser tidur atau perangkat mute.

Chrome dan Edge diuji langsung di Windows. Opera berbasis Chromium diharapkan memakai API standar yang sama tetapi tidak tersedia pada mesin pemeriksaan. Safari belum diuji langsung; iOS/iPadOS mempunyai persyaratan Home Screen khusus untuk Web Push background. Implementasi saat ini adalah SSE/Web Audio selama aplikasi terbuka, bukan Web Push background. Alarm hanya dijanjikan selama MABES LINK terbuka; saat browser tertutup, sumber pengingat tetap worker/outbox dan email internal jika SMTP aktif.

Smoke alarm baru memakai database UI test terisolasi, akun sementara yang dibersihkan otomatis, Edge headless, worker terpisah, notifikasi persisten dan SSE. Ikuti konfigurasi lengkap [panduan janji](./docs/appointment-reminders.md); jangan menunjuk ke server/database operasional:

```powershell
npm run build
$env:TEST_DATABASE_NAME='mabeslink_ui_test_20261008'
npm run start:test
# terminal lain, TEST_DATABASE_NAME sama dan server uji sudah dikonfigurasi:
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

Runner Vitest sekarang memaksa `DATABASE_PURPOSE=testing`, database
`TEST_DATABASE_NAME=mabeslink_test`, serta email nonaktif/dry-run. Nama database
testing harus mengandung `test`; bukan database operasional. Buat database tersebut
**sekali saja** memakai petugas DB berwenang dan terapkan migration di sana sebelum
tes. Jangan mengarahkan tes ke database operasional. Dua tes fixture XLSX lama
bersifat kondisional dan dilewati jika sumber 42 baris tidak tersedia.

### Audit UI dan membuat PDF aktual

Gunakan database khusus, misalnya `mabeslink_ui_test_20261008`, kosong pada awal
pengujian dan telah dimigrasi. Script membuat nama, koordinat, akun domain
`example.invalid` dan password acak, **bukan akun operasional**. Fixture guidebook
dipertahankan pada database UI test untuk inspeksi; jangan mengimpor ke produksi.

```powershell
# Setelah DB UI test dibuat terpisah; tidak me-reset DB existing:
$env:DATABASE_PURPOSE='testing'
$env:TEST_DATABASE_NAME='mabeslink_ui_test_20261008'
npm run db:deploy
npm run build
npm run start:test                 # localhost:3100; email dipaksa nonaktif
# Terminal kedua dengan TEST_DATABASE_NAME yang sama:
npm run test:audit-ui              # HTTP nyata, screenshot, PDF
npm run test:appointment-browser   # worker/SSE/alarm/snooze & holding; cleanup fixture sendiri
# Perbarui bagian UI final dari bukti audit existing dan smoke terbaru yang lulus:
npx tsx scripts/audit-ui-guide.ts --refresh-final
npx tsx scripts/verify-guidebook.ts # halaman dan screenshot tertanam dalam PDF
npm run test:visual                # form/audio/modal; sebagian payload disimulasikan
npm run test:home-visual
npm run test:qris-visual            # unggah/render/unduh QR samaran nyata
npx tsx scripts/qris-api-smoke.ts   # Batik, Alam dan Signature: PNG/PDF
```

Browser default Microsoft Edge pada Windows; `BROWSER_PATH` dapat menunjuk browser
Chromium lain yang terpasang. Skrip menolak host nonlokal. Jalankan audit login
secara berurutan: pembatasan autentikasi tetap aktif, jadi login paralel berulang
dapat menghasilkan 429 dan perlu menunggu. SSE dan alur layanan pada audit memakai
API nyata tanpa intercept; tes visual lama mengintercept satu submit janji untuk
memeriksa payload, bukan bukti persistence. Bukti screenshot/log tersedia di
`.artifacts/audit-ui/`; PDF publik repo berisi hanya data samaran.
Pembaruan PDF 8 Oktober memakai screenshot akuisisi, form, tracking, alarm dan
holding dari `.artifacts/appointment-smoke/`, mengganti gambar akuisisi lama;
halaman lain tetap screenshot aktual audit sebelumnya. Ini bukan klaim seluruh
audit lama telah diulang. Untuk crop screenshot holding saja setelah smoke penuh:
`npx tsx scripts/appointment-browser-smoke.ts --holding-only` (bukti terpisah pada
`holding-results.json`, tidak mengganti hasil smoke penuh).

Untuk smoke container terisolasi: build `docker build -t mabeslink:audit-20261008 .`,
lalu `npx tsx scripts/docker-runtime-check.ts` dengan database UI test di atas.
Ia menggunakan port loopback 3101, dua container bernama audit, volume test terpisah,
network container PostgreSQL lokal existing (tanpa restart/recreate DB), email
nonaktif, lalu menghentikan hanya container yang dibuatnya. Database/volume
test tetap ada; tidak menjalankan Compose atau restart database operasional.
Runtime, health, restart, persistence dan akses host 3101 lulus pada audit lokal.
Ini bukan bukti HTTPS/reverse proxy/jaringan deployment tujuan sudah dikonfigurasi.
PDF memakai font tertanam bila font TTF lokal tersedia; untuk mesin lain, isi
`GUIDEBOOK_FONT_REGULAR` dan `GUIDEBOOK_FONT_BOLD` dengan path font TTF yang diizinkan.

## Discovery dan cross-selling Mapping

Pada `/mapping`, pilih lokasi lalu buka **Discovery & peluang relevan**. Segmen 3P+1I, tag peluang, sumber/tanggal cek, produk yang sudah digunakan, dan screening GoFood/GrabFood dicatat terpisah dari penawaran. Semua data platform diisi manual. Ambang rating ≥4,5 dan ≥500 review, dengan pilihan satu/kedua platform dan masa data 30 hari, hanya **kriteria screening internal yang diminta pengguna**, bukan syarat/keputusan resmi Bank Mandiri. Foto lokasi opsional memakai storage privat existing. CIF, rekening, saldo, pasien, daftar gaji, dan dokumen tidak dimasukkan ke Mapping atau Excel.

Daftar produk penawaran memakai kode teknis yang didukung sumber publik, tetapi **otorisasi internal belum tersedia di repo**. Secara default `MAPPING_APPROVED_PRODUCT_CODES=""`, sehingga hanya discovery yang aktif; sesudah pemilik proses menyetujui katalog, set kode yang diizinkan pada environment server, misalnya satu kode untuk pilot. Kode yang tersedia: `LIVIN_MERCHANT_QRIS`, `LIVIN_MERCHANT_EDC`, `KOPRA_CASH_MANAGEMENT`, `LIVIN_ACCOUNT_OPENING`. Nama publik rujukan: [Livin’ Merchant](https://www.bankmandiri.co.id/en/livin-merchant/metode-pembayaran), [Kopra Cash Management](https://www.bankmandiri.co.id/in/cash-management1), [aktivasi Livin’](https://www.bankmandiri.co.id/en/livin/edukasi/cara-daftar-dan-aktivasi). Ini **bukan** bukti izin penawaran internal. `Livin’ Food` dipakai hanya sebagai tag screening dan belum diverifikasi sebagai nama/aturan produk resmi.

Respons **Minta follow-up** memerlukan izin, next action, dueAt WIB, dan PIC. Penyimpanan membuat `FollowUp` existing serta job reminder PostgreSQL; respons **Tidak tertarik/Tidak relevan** adalah hasil sah dan membatalkan reminder aktif. Perubahan PIC/jadwal menaikkan versi job sehingga worker tidak mengirim reminder lama. Penggunaan produk tetap dicatat terpisah; tidak ada persetujuan kredit, integrasi CAKRA, atau scraping platform.

Workbook 42 baris `link_mapping_6_Oktober_2026_REVISI.xlsx` adalah sumber historis
yang **sudah diganti**, bukan isi database lokal saat ini. Seeder CLI khusus workbook itu telah dihapus. Untuk
workbook 117 baris yang baru, gunakan pemeriksaan dan seeder baru di bagian awal
README. Format impor/ekspor UI tetap 14 kolom. Impor melalui UI tetap memerlukan
login, pratinjau, dan konfirmasi; koordinat Excel bertanda belum diverifikasi.
Jangan mengisi `0,0` sebagai pengganti lokasi yang belum diketahui.

Google Maps URLs membuka pencarian tempat lewat klik petugas tanpa API key, tetapi **tidak mengembalikan koordinat ke MABES LINK**. [Dokumentasi Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) membedakannya dari [Geocoding API](https://developers.google.com/maps/documentation/geocoding/usage-and-billing), yang memerlukan billing dan kredensial. Tidak ada scraping Google Maps. `LOCATION_SEARCH_URL` opsional memakai provider Photon-compatible milik organisasi/yang diizinkan; hasilnya tetap kandidat dan tidak otomatis disimpan. Workbook **baru** berisi 117 pasangan koordinat yang bersumber dari workbook, bukan hasil verifikasi otomatis Google Maps; seluruhnya tetap ditandai perlu pemeriksaan. Data kosong tidak diisi dengan tebakan atau klaim relasi nasabah.

Beranda publik `/` sekarang memakai aset logo Mandiri, Livin', Kopra, Livin' Merchant, Danantara Indonesia, mockup QRIS yang disediakan, pilihan template, FAQ, dan footer responsif. Mockup berisi QR contoh yang tidak boleh digunakan untuk pembayaran; penawaran gratis hanya desain/bingkai digital, bukan akrilik/material cetak. Pengguna yang sudah login tetap menuju dashboard operasional, yang juga menampilkan promosi QRIS ringkas.

`test:qris-visual` memerlukan `npm run start:test` pada terminal lain serta database `mabeslink_test` yang telah menerima migration. Tes memakai QR samaran dan **tidak** menciptakan prospek karena consent kontak dimatikan. `scripts/qris-api-smoke.ts` dapat dijalankan terhadap server testing yang sama dengan `DATABASE_PURPOSE=testing`; script membuat lalu menghapus sesi QR uji dan memeriksa respons PNG/PDF lewat HTTP.

```powershell
$env:DATABASE_PURPOSE='testing'
$env:TEST_DATABASE_NAME='mabeslink_test'
npx tsx scripts/qris-api-smoke.ts
```
