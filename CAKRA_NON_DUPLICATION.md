# Audit Non-Duplikasi CAKRA

Tanggal audit kode: 5 Oktober 2026 (Asia/Jakarta)

## Kesimpulan

MABES LINK tidak boleh menjadi sumber prospek, pipeline akuisisi, kunjungan, atau reminder akuisisi kedua bila fungsi tersebut telah tersedia dan disetujui di CAKRA. Repo tidak mengasumsikan API, hak akses, struktur data, ataupun kemampuan CAKRA/core banking. Kesesuaian fungsi CAKRA yang sebenarnya masih memerlukan konfirmasi pemilik proses dan sistem internal.

Model bernama `Prospect` dipertahankan karena merupakan model existing dari implementasi sebelumnya. Dalam konfigurasi operasional model ini diperlakukan sebagai **referensi kerja lokal**, bukan master lead. Form **Buat janji** sekarang dapat membuat referensi kerja tersebut secara atomik tanpa meminta nomor CAKRA; record ditandai oleh `ServiceCase.sourceSystem=MABES_LINK`, sedangkan `cakraReference` tetap kosong. Ini adalah keputusan UX operasional yang diminta dan masih memerlukan persetujuan pemilik proses sebelum data nyata dipakai; tidak diklaim sebagai pengganti atau sinkronisasi CAKRA.

## Batas kepemilikan data

| Fungsi                | Perlakuan di MABES LINK                                                                                            | Status kesesuaian internal                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Lead/prospek akuisisi | Menu Akuisisi membuat referensi kerja lokal otomatis bersama janji, tanpa nomor CAKRA dan tanpa input ulang ke tabel prospek lain | Kepemilikan master CAKRA dan rekonsiliasi belum diverifikasi |
| Pipeline sales        | Kolom existing dipertahankan untuk kompatibilitas data dan dashboard lama, bukan pengganti pipeline resmi          | Tumpang tindih perlu keputusan pemilik proses            |
| Kunjungan             | Riwayat existing dipertahankan agar tidak kehilangan data; input baru harus mengikuti sumber/proses yang diizinkan | Kemampuan CAKRA belum diverifikasi                       |
| Reminder akuisisi     | Reminder MABES LINK melekat pada `ServiceCase` dan ditujukan kepada PIC internal untuk membuat/mengonfirmasi janji | Batas dengan reminder CAKRA perlu verifikasi internal    |
| Janji                 | Form langsung membuat janji dan referensi kerja lokal yang sama dalam satu transaksi; tidak meminta atau mengarang referensi CAKRA | Integrasi kalender/CAKRA tidak diasumsikan               |
| Kendali layanan       | `ServiceCase` menyatukan kasus in-branch/out-branch sampai ditutup dan memisahkan penyelesaian dari penggunaan     | Fokus implementasi MABES LINK                            |
| Lokasi/foto           | Metadata tambahan pada referensi yang sama; foto privat hanya untuk mengenali tempat                               | Kebijakan data/lokasi organisasi wajib disetujui         |
| Batas wilayah peta    | Overlay referensi administratif Mangga Besar untuk filter/fokus; tidak membuat lead, visit, atau skor baru         | Cakupan wilayah kerja cabang wajib dikonfirmasi internal |

## Kontrol teknis

- `ServiceCase.prospectId` memakai foreign key ke record existing; pekerjaan, peta, foto, visit, follow-up, handover, dan penggunaan tidak membuat tabel master prospek baru.
- Pasangan `sourceSystem` + `sourceReference` pada `ServiceCase` unik untuk mencegah duplikasi referensi sumber yang sama.
- `cakraReference` pada `Prospect` unik dan opsional.
- UI pekerjaan tidak meminta nomor/referensi CAKRA. Satu transaksi membuat referensi kerja lokal dan `ServiceCase`; tidak ada tabel lead kedua.
- Form janji menyimpan kontak yang ditemui, alias toko opsional, tujuan, PIC internal, jadwal, dan lokasi pada model existing dengan audit. Data ini belum dianggap master CAKRA.
- Menu Mapping membaca record `Prospect` yang sama: lokasi penggunaan `UsageVerification=VERIFIED` ditampilkan terpisah dari permintaan QRIS Custom publik yang memberi consent. Permintaan publik **bukan** bukti penggunaan. Pencarian/filter, marker, sumber/waktu lokasi, dan foto tidak membentuk master lead atau master lokasi kedua.
- QRIS Custom publik tanpa izin dihubungi hanya memiliki sesi file sementara dan tidak membuat `Prospect`. Dengan izin dihubungi, satu `Prospect` existing dibuat dengan `publicQrisRequestId`/`publicDedupKey` unik, `FollowUp` internal, PIC cabang 11539, dan audit; tidak ada tabel lead kedua atau sinkronisasi CAKRA. Kesetaraan/rekonsiliasi dengan lead CAKRA belum disetujui pemilik proses.
- API pembuatan prospek manual mengembalikan `MANUAL_REFERENCE_DISABLED` kecuali flag server secara eksplisit diaktifkan.
- Tidak ada endpoint, token, scraper, atau kredensial CAKRA/Kopra/core banking di repo.
- Seeder role khusus testing tidak membuat lead/prospek, visit, pipeline, atau reminder CAKRA. Seeder menolak database operasional, hanya membuat empat akun domain `.test` pada database yang namanya mengandung `test`, dan kredensialnya hanya ditulis ke `role.md` yang diabaikan Git.
- Tidak ada seeder data bisnis, kredensial demo pada UI, integrasi, atau sinkronisasi CAKRA di repo. Fixture tes lain dibuat sementara oleh suite tes dan dibersihkan setelah pemeriksaan.
- ADMIN mempunyai cakupan aplikasi lintas cabang, tetapi flag ini tidak memberi akses ke CAKRA/core banking dan bukan pengganti kewenangan sistem sumber.

## Keputusan yang belum terbukti

Sebelum penggunaan data nyata, pemilik proses/sistem perlu menentukan: sistem master untuk lead dan kunjungan; mekanisme link/import yang diizinkan; data minimum yang boleh disalin; retensi; rekonsiliasi duplikasi; serta apakah reminder CAKRA sudah mencukupi. Sampai keputusan itu ada, repo tidak mengklaim kebaruan, integrasi, atau ketiadaan kemampuan serupa di Mandiri.
