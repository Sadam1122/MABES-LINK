# Status Implementasi MABES LINK

Tanggal pemeriksaan terakhir: 5 Oktober 2026 (Asia/Jakarta)

## Ringkasan aktual

Repo existing dilanjutkan tanpa mengganti stack, reset database operasional, atau deployment publik. Seeder data bisnis dan seeder notifikasi tetap tidak ada. Seeder baru `seed:roles` hanya untuk empat akun testing, memiliki pengaman berlapis, dan telah diuji pada database terpisah `mabeslink_test`.

Database lokal mempertahankan cabang `11539` dan migration existing. Setelah data seed dibersihkan, akun operasional dibuat melalui alur aplikasi; pemeriksaan terakhir menemukan dua akun non-test dengan role yang diizinkan. `bootstrap:admin` hanya diperlukan bila belum ada ADMIN aktif dan menolak berjalan bila ADMIN operasional sudah tersedia. Tidak ada kredensial default. Role aplikasi hanya `ADMIN`, `CS`, `SUPERVISOR`, dan `OUT_BRANCH`; UI menampilkan label `OUTBRANCH` tanpa mengganti enum database existing.

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

Enam migration terpasang dan database operasional maupun `mabeslink_test` sudah menerima migration aditif `20261004090000_add_location_source`; tidak ada reset atau penghapusan data. Kolom nullable `Prospect.locationSource` menyimpan `MAP_PIN`, `MANUAL_COORDINATES`, atau `DEVICE_GEOLOCATION` tanpa membuat master lokasi/prospek baru.

Model penting tetap: `Prospect`, `FollowUp`, `Visit`, `HandoverBatch`, `ExceptionCase`, `UsageVerification`, `ServiceCase`, `Notification`, `OutboxJob`, `EmailDelivery`, `LocationPhoto`, `AuditLog`, dan `WorkerHeartbeat`. Koordinat tersimpan sebagai `Decimal(10,7)`, lokasi/foto memakai record prospek yang sama, dan readiness layanan tetap berbeda dari penggunaan terverifikasi.

## Role dan cakupan server

- `OUT_BRANCH` / label `OUTBRANCH`: prospek yang dibuat/ditugaskan, pekerjaan sendiri, lokasi/visit/follow-up sendiri, dan handover yang dikirim.
- `CS`: pekerjaan yang ditugaskan dan handover yang diterima; penyelesaian/penggunaan sesuai kewenangan.
- `SUPERVISOR`: seluruh data non-test cabangnya, assign/reassign, verifikasi, dan penutupan.
- `ADMIN`: visibilitas dan administrasi lintas cabang, seluruh mapping operasional, akun, dan konfigurasi. ADMIN tetap tidak memalsukan pengakuan penerimaan yang secara audit harus dilakukan PIC penerima.

Scope diulang pada query API, mutation, SSE, dan akses gambar. ADMIN tidak mendapat akses tersirat ke CAKRA/core banking.

## Perubahan selesai

### Janji akuisisi, mapping penggunaan, dan detail notifikasi

- Menu **Akuisisi Nasabah** kini membuka form **Buat janji** dari referensi existing. Form mengisi orang yang ditemui dari record yang sama, menerima nama toko/usaha opsional, alasan/tujuan, PIC internal, waktu janji WIB, pin peta/geolocation, label lokasi, serta satu foto lokasi opsional dengan preview.
- Penyimpanan janji memperbarui konteks pada `Prospect` existing dengan optimistic concurrency (`version`) dan audit `APPOINTMENT_CONTEXT_UPDATED`, lalu membuat `ServiceCase` berstatus janji `CONFIRMED`. Foto melewati endpoint privat dan validasi/re-encode server existing; kegagalan foto tidak menghilangkan janji yang sudah berhasil disimpan dan dilaporkan jelas ke pengguna.
- Reminder untuk janji `CONFIRMED` dijadwalkan terhadap `appointmentAt`, 30 menit sebelum dan saat waktu janji. Worker tetap memvalidasi ulang versi, PIC, status janji, dan status kasus; selesai/batal membatalkan job aktif.
- Mapping sekarang hanya mengambil record dengan penggunaan produk `VERIFIED`. Kartu dan popup marker menampilkan pengguna/kontak, daftar produk, tanggal verifikasi, PIC internal, lokasi, serta tautan koordinat Google Maps. Data pipeline yang belum mempunyai penggunaan terverifikasi tidak disajikan seolah sudah menjadi pengguna.
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
- Header desktop dan kartu scope menampilkan role/cakupan aktif. ADMIN ditandai akses superadmin lintas cabang; navigasi memakai label **Akuisisi Nasabah**, **Mapping**, **Notifikasi**, **Pengaturan Notifikasi**, dan **Manajemen Pengguna** khusus ADMIN.
- Fitur existing tetap: lokasi manual/pin/geolocation, Google Maps URLs, Haversine, urutan terdekat, dan foto privat.

### Notifikasi laptop/HP

- Tombol Notifikasi sekarang membuka dropdown daftar terlebih dahulu; modal detail hanya muncul setelah **Lihat detail** dipilih. Badge unread, status SSE/polling, tandai dibaca/semua dibaca, tautan internal, loading, empty, error, waktu WIB, dan deduplikasi tetap tersedia.
- Halaman **Pengaturan Notifikasi** terpisah menyediakan **Aktifkan Suara**, **Tes Suara**, volume 0-100%, mute, stop, pengulangan 1/3/5/10/20 kali, pilihan jenis reminder, file alarm lokal opsional, izin notifikasi sistem, dan status aktif/perlu aktivasi ulang. Jadwal global hanya dapat diubah ADMIN.
- Pengelola audio singleton memakai `AudioContext`/`GainNode`, dibuat atau dilanjutkan hanya dari klik pengguna, menghentikan nada lama sebelum nada baru, dan menyimpan preferensi per user/perangkat tanpa menganggap autoplay telah terbuka setelah reload.
- Akar masalah implementasi lama diperbaiki: `AudioContext` sebelumnya hanya dibuat bersamaan dengan izin notifikasi browser, dan effect SSE dibuat ulang setiap perubahan mode/pengulangan. Aktivasi audio kini mandiri dan koneksi SSE tidak bergantung pada kontrol suara.
- Service worker `public/mabeslink-notifications-sw.js` menampilkan notifikasi sistem yang dapat membuka tautan internal; URL lintas origin ditolak.
- Initial history tidak dibunyikan. Cursor SSE dimulai setelah initial fetch, claim `localStorage` dan `BroadcastChannel` mengurangi duplikasi antar-tab/reconnect. Janji terkonfirmasi sekarang dijadwalkan tepat 30 menit sebelum dan pada `appointmentAt`, dikategorikan sebagai suara janji, dan menjadi pengecualian jam senyap; quiet hours tetap mematikan bunyi reminder umum tanpa menyembunyikan notifikasi visual.
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
- Logo `/Gambar/logo.png` dipakai pada sidebar, header mobile, login, loading, dan metadata icon tanpa absolute Windows path.
- `postinstall` dan `prebuild` menjalankan `prisma generate`. Seluruh Client Component tidak lagi mengimpor runtime `@prisma/client`, sehingga Turbopack tidak mencoba membundel `.prisma/client/index-browser`; build telah diuji dari kondisi generated client belum tersedia.

## Endpoint dan file penting

- Health/auth: `GET /api/health`, `/api/auth/[...all]`.
- Pekerjaan: `/api/service-cases`, `/api/follow-ups`, `/api/handovers`, `/api/usage-verifications`.
- Mapping: `/api/mapping`, `/api/visits`, `/api/prospects/:id`, endpoint foto privat.
- Notifikasi: `/api/notifications`, `/api/notifications/:id`, `/api/notifications/stream`.
- Admin: `/api/admin/users`, `/api/admin/config`, `/api/admin/notification-config`.
- Peta: `components/mapping-map.tsx`, `components/mapping-workspace.tsx`, `lib/mangga-besar-boundary.ts`.
- Alarm/pengaturan: `components/notification-center.tsx`, `components/notification-audio-settings.tsx`, `public/mabeslink-notifications-sw.js`.
- Dialog/feedback/audio: `components/ui/dialog.tsx`, `components/ui/feedback.tsx`, `lib/client/notification-audio.ts`.
- Worker/SMTP: `worker/index.ts`, `lib/notifications.ts`, `scripts/smoke-test-email.ts`.
- Provisioning: `scripts/bootstrap-admin.ts`.
- Testing role: `scripts/seed-roles.ts`, `scripts/role-access-check.ts`, `scripts/start-test-server.ts`, `role.md` (lokal/ignored).

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

Worker harus selalu berjalan terpisah dari web. Reverse proxy internal harus menyediakan HTTPS agar cookie production, geolocation, service worker, dan notifikasi perangkat berfungsi.

Untuk role testing, buat database terpisah `mabeslink_test`, deploy migration ke database tersebut, isi flag TESTING dari `.env.example`, lalu jalankan `npm run seed:roles`. Kredensial aktual berada hanya di `role.md`. Gunakan `npm run start:test` dan `npm run test:roles`; hapus akun dengan `npm run seed:roles:remove` menggunakan pengaman yang sama.

## Hasil pemeriksaan aktual

- Prisma format/validate: berhasil.
- Migration status: 6 migration, schema up to date, tanpa reset.
- Typecheck: berhasil.
- ESLint: berhasil tanpa error/warning setelah perbaikan effect izin notifikasi.
- Tes: 7 file / 35 tes berhasil. Termasuk akses lintas petugas/cabang, handover, status/penggunaan, reminder janji terkonfirmasi dan pembatalannya saat selesai, dua worker, recovery restart, timezone, isolasi notifikasi, kategori alarm janji dan pengecualian jam senyap, SMTP dry-run/failure/quota, koordinat, Haversine, foto privat, polygon Mangga Besar, volume/pengulangan alarm, deduplikasi audio, pengaman database testing, dan scope ADMIN.
- `seed:roles` dijalankan ulang pada `mabeslink_test` dan terbukti idempotent. `test:roles` membuktikan login UI keempat role, menu Manajemen Pengguna hanya ADMIN, API admin 200 untuk ADMIN/403 untuk tiga role lain, API mapping 200 sesuai sesi, dan route `/admin` dialihkan untuk non-ADMIN.
- Production build: berhasil; 27/27 halaman statis selesai dan route dinamis termasuk `/notification-settings` terdaftar. Regresi Prisma Client Browser tidak muncul.
- UI 1440×900, 768×1024, 390×844, dan 360×800: Mapping, polygon, filter, dropdown lalu modal detail notifikasi, scope/header role, tile attribution, dan navigasi mobile tampil tanpa overflow horizontal atau console error. Tes headless juga memeriksa tandai dibaca, focus restore, overlay, Escape, dirty confirmation, kontrol audio 0/50/100/mute, pengulangan 20 kali, dan decode/upload WAV lokal tanpa error.
- Smoke alarm non-headless berhasil: akun uji sementara login, audio diaktifkan melalui klik browser, notifikasi `APPOINTMENT_ACTION_DUE` persisten diterima melalui SSE, toast muncul, dan Web Audio dijadwalkan lima kali. Script membersihkan akun/notifikasi uji. Keluaran fisik speaker tetap perlu dikonfirmasi oleh pendengar.
- Smoke SMTP nyata dijalankan dengan opt-in sementara, tetapi berhenti sebelum koneksi karena `SMTP_PASS` kosong. Tidak ada email yang dikirim dan tidak ada klaim inbox. `EMAIL_ENABLED=false` serta `SMTP_DRY_RUN=true` tetap menjadi nilai aman pada environment lokal.
- Data operasional existing tidak diubah atau dihapus. Empat akun role `.test` tetap terisolasi di `mabeslink_test`; fixture integrasi/visual lain dibersihkan otomatis.
- Warning yang masih terlihat: driver `pg` memberi deprecation warning untuk concurrent query yang akan berubah pada pg 9; tes tetap lulus.

## Belum terbukti / tindak lanjut internal

- Kredensial SMTP resmi, sender/domain verification, quota akun aktual, `SMTP_ACCEPTED`, deliverability inbox, bounce, dan email ke alamat uji belum terbukti.
- Notifikasi sistem perlu diuji manual pada laptop/HP organisasi melalui HTTPS dan izin browser. Background notification saat aplikasi tertutup memerlukan desain Web Push/VAPID terpisah; tidak diklaim tersedia.
- Tes suara headless membuktikan kontrol dan Web Audio tidak error, tetapi suara yang benar-benar terdengar pada speaker laptop/HP belum diverifikasi manual.
- Batas wilayah kerja cabang harus dikonfirmasi internal; polygon saat ini hanya referensi administratif sumber publik DKI.
- Kepemilikan master lead/visit/reminder CAKRA, data contract, link/import resmi, rekonsiliasi, dan retensi belum dikonfirmasi pemilik sistem.
- Restore drill database+foto, enkripsi/retensi backup, SSO, CSP/hardening formal, DAST/SAST, pentest, uji beban/failover, alerting, dan approval infrastruktur belum selesai.

Tidak ada deployment publik, data nyata bank, integrasi CAKRA/core banking, keputusan kredit otomatis, atau bypass OTP/biometrik.
