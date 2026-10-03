# Status Implementasi MABES LINK

Tanggal pemeriksaan terakhir: 3 Oktober 2026 (Asia/Jakarta)

## Ringkasan aktual

Repo existing telah dilanjutkan tanpa reset database, penggantian stack, atau deployment publik. UI login dan area aplikasi hanya menampilkan MABES LINK serta menu operasional berbasis role: Beranda, Pekerjaan, Peta, Notifikasi, dan Pengaturan untuk ADMIN. Label fase pengembangan, tombol seeder, kredensial development, dan data test tidak muncul pada tampilan operasional.

Implementasi menghasilkan build dan image yang dapat dijalankan, namun belum dinyatakan production-ready. Approval keamanan/infrastruktur, verifikasi proses CAKRA, drill restore, deliverability SMTP, uji beban/failover, dan observability organisasi masih diperlukan.

## Arsitektur dan versi

- Web/backend: Next.js App Router 16.3.8, React 19.2.8, TypeScript 5, Route Handlers Node.js.
- UI: Tailwind CSS 4, Leaflet 1.9.4, React Leaflet 5.0.0.
- Data: PostgreSQL 16, Prisma/Prisma Client 7.10.0, kolom waktu `timestamptz(3)` dan penyajian Asia/Jakarta.
- Auth: Better Auth 1.7.7, password provider library, signup publik nonaktif, session cookie HTTP-only/SameSite, secure cookie pada production.
- Validasi/delivery/media: Zod 4.6.5, Nodemailer 10.0.13, Sharp 0.35.5.
- Scheduler: proses Node.js terpisah dari web, outbox PostgreSQL, heartbeat dan lease persisten.
- Deployment: satu image `mabeslink:internal`; service Compose terpisah untuk database, migration, web, dan worker.

Alur request: UI/Route Handler → sesi → pemeriksaan role/cabang/penugasan → validasi Zod → service/transaksi Prisma → PostgreSQL/AuditLog. Alur worker: jadwal PostgreSQL → atomic claim/lease → validasi ulang versi/status/PIC → Notification persisten → SMTP opsional → status delivery. Operasi jaringan SMTP tidak berlangsung di dalam transaksi claim.

## Migration dan skema

Lima migration tercatat dan `prisma migrate status` menyatakan schema up to date:

1. `20261002055845_init`
2. `20261002061500_unique_prospect_handover`
3. `20261002072718_stage2_mapping_notifications`
4. `20261002082930_operational_service_cases_locations`
5. `20261002083053_isolate_test_notifications`

Migration terbaru bersifat additive, kecuali penggantian indeks non-unik dengan indeks yang mencakup flag test; tidak ada tabel/baris existing yang dihapus dan tidak ada reset.

Model penting:

- `Prospect`: record existing bersama, referensi CAKRA opsional/unik, metadata lokasi, koordinat `Decimal(10,7)`, kebutuhan produk, PIC, visit/follow-up/handover/penggunaan, serta relasi ke `ServiceCase` dan `LocationPhoto`.
- `ServiceCase`: satu kasus in-branch/out-branch dengan `CREATED`, `ASSIGNED`, `ACCEPTED`, `IN_PROGRESS`, cabang menunggu/eskalasi, `HANDLED`, `VERIFIED`, `CLOSED`, `REOPENED`, `CANCELLED`; optimistic `version`; next action/dueAt; status/waktu janji; penerimaan PIC; source reference unik; audit.
- `Notification`, `OutboxJob`, `EmailDelivery`: recipient, branch, service case/follow-up, schedule version, unique dedup key, lease, attempts, status, messageId/preview/error.
- `LocationPhoto`: storage key privat, MIME hasil re-encode, ukuran, dimensi, checksum, creator, timestamp, FK ke record existing.
- `WorkerHeartbeat`: identitas proses, hostname, PID, startedAt, dan lastSeen.
- `isTest`/`testNamespace`: isolasi data seeder email dari query operasional, dashboard, laporan, SSE, dan daftar akun.

## Role dan izin server

- `OUT_BRANCH`: pekerjaan/prospek yang ditugaskan atau dibuat sendiri sesuai scope; lokasi/visit/follow-up sendiri; handover yang dikirim.
- `CS`: pekerjaan yang ditugaskan, handover yang diterima, subkasus/penyelesaian/penggunaan sesuai kewenangan; tidak mengubah mapping prospek langsung.
- `SUPERVISOR`: seluruh data non-test cabangnya, assign/reassign, verifikasi/penutupan.
- `ADMIN`: administrasi lintas cabang dan konfigurasi; record test tetap dikeluarkan dari daftar operasional.

Penerimaan `ServiceCase` hanya dapat dilakukan oleh PIC yang ditugaskan, termasuk ketika caller adalah supervisor. Verifikasi dan penutupan memerlukan supervisor/admin. Semua endpoint pekerjaan, peta, notifikasi, SSE, dan gambar mengulangi scope di server; tombol tersembunyi bukan kontrol akses utama.

## Fungsi selesai

### Pekerjaan dan janji

- Form membuat pekerjaan memilih referensi existing dan tidak meminta ulang identitas/kebutuhan dasar.
- Transisi layanan tervalidasi, termasuk alasan wajib untuk menunggu/eskalasi, optimistic conflict, timestamp, dan audit perubahan.
- `NEEDS_SCHEDULING`, `PENDING_CONFIRMATION`, `CONFIRMED`, `COMPLETED`, dan `CANCELLED` dibedakan; waktu janji wajib saat terkonfirmasi.
- Reschedule/reassign/status janji/penyelesaian membatalkan reminder versi lama. Readiness layanan dan penggunaan produk ditampilkan terpisah.
- Pembuatan referensi prospek manual nonaktif secara default untuk menghindari basis lead kedua. Audit batas CAKRA ada di `CAKRA_NON_DUPLICATION.md` dan tidak mengklaim API/kebaruan internal.

### Peta, geolocation, Google Maps, dan jarak

- Leaflet client-side dengan daftar fallback, marker tersimpan, manual pin/koordinat, “Lokasi saya”, konfirmasi penyimpanan, filter dan nearest sorting.
- Latitude/longitude wajib lengkap atau sama-sama kosong, rentang tervalidasi, nilai 0 tidak dianggap kosong, dan lokasi memiliki label/waktu pembaruan.
- Penolakan izin, unavailable, timeout, dan akurasi rendah mempunyai pesan berbeda. Posisi perangkat hanya state sementara tanpa tracking kontinu/riwayat GPS.
- URL lokasi/navigasi dibentuk dengan `URL`/`URLSearchParams` dan hanya membawa koordinat. Jarak Haversine dilabeli “Jarak garis lurus”; rute/waktu tempuh diserahkan ke navigasi Google Maps.

### Foto lokasi privat

- Upload opsional, preview, thumbnail, ganti, dan hapus; form lokasi tetap dapat disimpan tanpa foto.
- Default maksimum 3 file, 5 MB/file, dimensi 8.000 px; JPEG/PNG/WebP saja.
- Server menguji isi/decode melalui Sharp, menolak format lain termasuk SVG, merotasi menurut orientasi, resize maksimum 2048, re-encode WebP tanpa metadata/EXIF, dan memakai UUID acak.
- File disimpan pada volume `PRIVATE_STORAGE_PATH` di luar webroot; database menyimpan metadata/checksum. GET/PATCH/DELETE gambar berotorisasi dan perubahan masuk audit log.

### Reminder, SSE, dan email

- Worker default tick 60 detik dan harus selalu berjalan terpisah dari web/browser.
- Atomic claim memakai `FOR UPDATE SKIP LOCKED`, unique dedup key, lease dua menit, retry maksimum/backoff, dan pemulihan lease setelah restart. Dua worker tidak memperoleh job yang sama.
- SSE memeriksa database default setiap 2 detik dengan recipient/branch scope, cursor dan reconnect; UI fallback polling 5 detik.
- Email hanya ke alamat petugas internal aktif/diizinkan. Konten hanya kode tugas, jenis reminder, waktu WIB, dan tautan login; tidak memasukkan nama/telepon/rekening/alamat/saldo/gambar/dokumen nasabah.
- Status dibedakan: `QUEUED`, `DRY_RUN`, `SMTP_ACCEPTED`, `FAILED`, `UNKNOWN`, `DISABLED`, `QUOTA_BLOCKED`. Failure/quota memakai retry terbatas; status ambigu tidak diretry otomatis. SMTP accepted tidak dianggap bukti inbox.
- `seed:test-notifications` idempotent membuat dua tugas samaran pada namespace terisolasi dan tidak mengirim langsung. `smoke:test-email` mengunci recipient, memerlukan opt-in eksplisit, memverifikasi transport, dan dedup per hari.

## Endpoint utama

- `GET /api/health`
- `GET/POST /api/service-cases`
- `GET/PATCH /api/service-cases/:id`
- `GET /api/mapping`, `POST /api/visits`
- `PATCH /api/prospects/:id`, `POST /api/prospects/:id/photos`
- `GET/PATCH/DELETE /api/location-photos/:id`
- `GET /api/notifications`, `PATCH /api/notifications/:id`, `GET /api/notifications/stream`
- Endpoint existing prospek, follow-up, handover/subkasus, usage verification, dashboard, akun dan notification config tetap tersedia dan dikontrol server.

## File penting

- `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`
- `lib/authorization.ts`, `lib/validation.ts`, `lib/workflow.ts`
- `lib/services/service-cases.ts`, `lib/notifications.ts`, `worker/index.ts`
- `lib/geo.ts`, `lib/services/location-photos.ts`
- `app/(app)/work/`, `app/(app)/mapping/`, `app/(app)/notifications/`
- `app/api/service-cases/`, `app/api/location-photos/`, `app/api/health/`
- `scripts/seed-test-notifications.ts`, `scripts/smoke-test-email.ts`
- `Dockerfile`, `docker-compose.production.yml`, `.env.production.example`
- `scripts/backup.ps1`, `scripts/restore.ps1`, `CAKRA_NON_DUPLICATION.md`
- `tests/operational.integration.test.ts` dan suite regresi existing.

## Hasil pemeriksaan aktual

- Prisma format/validate/generate: berhasil.
- Migration status: 5 migration, database up to date, tanpa reset.
- Seed dasar: berhasil; seeder notification dijalankan dua kali dan tetap menghasilkan total 4 deduplicated job untuk 2 tugas.
- Worker dry-run: 3 delivery `DRY_RUN`; job sisa kemudian diproses dengan email nonaktif sebagai `DISABLED`. Seluruh 4 job selesai dan tidak ada notifikasi test yang terlihat sebagai notifikasi operasional.
- Typecheck: berhasil.
- ESLint: berhasil tanpa error/warning.
- Tes: 4 file / 23 tes berhasil. Cakupan bermakna termasuk lintas petugas/cabang, penerimaan PIC, transisi invalid, pemisahan readiness/penggunaan, dua worker, recovery restart, timezone, isolasi SSE/test, SMTP dry-run/failure/quota, koordinat 0/batas/pasangan, Google URLs, Haversine, pesan kegagalan GPS, gambar valid/invalid/SVG, replace/delete dan akses privat.
- Production build lokal: berhasil; static generation 26/26 dan seluruh Route Handler terdaftar, tanpa warning tracing storage setelah storage eksternal ditandai untuk bundler.
- Docker Compose config: valid menggunakan `.env.production.example`.
- Image `mabeslink:internal`: berhasil dibangun. Dependency runtime dipasang dengan `--omit=dev` dan audit build melaporkan 0 vulnerability.
- Smoke image web: Next production start berhasil; `/api/health` mengembalikan database `ok`.
- Smoke image worker: tick pertama berhasil dan `npm run worker:health` menyatakan heartbeat sehat.
- Persistensi restart PostgreSQL: jumlah branch 2 sebelum/sesudah restart dan container kembali `healthy`.
- UI desktop 1440×900 dan HP 390×844: login, peta, menu role, tile/atribusi, dan navigasi mobile tampil; tidak ada overflow horizontal, console error, atau label pengembangan terlarang. Screenshot test berada di `.artifacts/` dan tidak dilacak Git.
- Sintaks script backup/restore: valid. Restore drill penuh **belum dijalankan**.
- Smoke email nyata: secara sengaja tidak dijalankan karena kredensial SMTP resmi tidak tersedia. Script terbukti menolak eksekusi ketika `EMAIL_ENABLED=true`/`SMTP_DRY_RUN=false` belum diaktifkan eksplisit. Tidak ada klaim email masuk inbox.
- `npm audit --omit=dev`: 0 vulnerability. Audit penuh masih melaporkan advisory high pada rantai `eslint-config-next → fast-glob → micromatch → braces` yang hanya dipakai tooling development; registry belum menyediakan versi `braces` di atas 3.0.3 pada pemeriksaan ini, sehingga pemaksaan downgrade lint tidak dilakukan.
- Saat Next/SSE dihentikan paksa, `pg` 8.23.1 mencetak deprecation warning query concurrent yang akan berubah pada pg 9; tidak ada test gagal, tetapi graceful shutdown/upgrade perlu dipantau.

## Cara menjalankan

Lokal: `docker compose up -d postgres` → `npm ci` → `npm run db:generate` → `npm run db:deploy` → `npm run db:seed` → `npm run dev:all`.

Internal Compose: isi `.env.production`, lalu `docker compose --env-file .env.production -f docker-compose.production.yml up -d --build`. Jangan menjalankan seed development di production. Detail backup, restore, SMTP, storage, dan verifikasi ada di `README.md`.

## Belum terbukti / tindak lanjut internal

- Kepemilikan master lead/visit/reminder CAKRA, mekanisme link/import resmi, data contract, rekonsiliasi, dan retensi belum dikonfirmasi pemilik sistem. Tidak ada integrasi CAKRA/core banking yang diklaim.
- SMTP eksternal nyata, sender/domain verification, quota akun aktual, deliverability inbox, dan status bounce belum diuji.
- Restore drill database+foto, enkripsi/retensi backup, object storage/signed URL alternatif, uji beban, failover multi-instance, alerting, audit retention, SSO/enterprise identity, CSP/hardening formal, DAST/SAST, pentest, aksesibilitas formal, dan approval organisasi belum selesai.
- Tile provider, lokasi, foto, dan hosting nyata wajib mendapat persetujuan privasi/keamanan. Infrastruktur web, worker, PostgreSQL, storage, backup, TLS/reverse proxy, monitoring dan operasional tetap mempunyai biaya terpisah dari kuota SMTP gratis.

Tidak ada deployment publik, data nyata bank, keputusan kredit otomatis, bypass OTP/biometrik, atau klaim bahwa fungsi ini belum pernah ada di Mandiri.
