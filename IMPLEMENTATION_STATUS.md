# Status Implementasi MABES LINK

Tanggal perubahan terakhir: 7 Oktober 2026 (Asia/Jakarta)

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
