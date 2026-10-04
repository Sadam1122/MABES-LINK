# Audit Non-Duplikasi CAKRA

Tanggal audit kode: 5 Oktober 2026 (Asia/Jakarta)

## Kesimpulan

MABES LINK tidak boleh menjadi sumber prospek, pipeline akuisisi, kunjungan, atau reminder akuisisi kedua bila fungsi tersebut telah tersedia dan disetujui di CAKRA. Repo tidak mengasumsikan API, hak akses, struktur data, ataupun kemampuan CAKRA/core banking. Kesesuaian fungsi CAKRA yang sebenarnya masih memerlukan konfirmasi pemilik proses dan sistem internal.

Model bernama `Prospect` dipertahankan karena merupakan model existing dari implementasi sebelumnya. Dalam konfigurasi operasional model ini diperlakukan sebagai **referensi kerja lokal**, bukan master lead. Pembuatan referensi manual dinonaktifkan secara default melalui `ALLOW_MANUAL_REFERENCE_ENTRY=false`. `cakraReference` tetap opsional dan unik; tidak ada scraping atau sinkronisasi yang diklaim.

## Batas kepemilikan data

| Fungsi                | Perlakuan di MABES LINK                                                                                            | Status kesesuaian internal                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Lead/prospek akuisisi | Menu Akuisisi Nasabah memakai `Prospect` existing sebagai pointer/referensi kerja; form pembuatan manual nonaktif secara default | Kepemilikan master CAKRA belum diverifikasi              |
| Pipeline sales        | Kolom existing dipertahankan untuk kompatibilitas data dan dashboard lama, bukan pengganti pipeline resmi          | Tumpang tindih perlu keputusan pemilik proses            |
| Kunjungan             | Riwayat existing dipertahankan agar tidak kehilangan data; input baru harus mengikuti sumber/proses yang diizinkan | Kemampuan CAKRA belum diverifikasi                       |
| Reminder akuisisi     | Reminder MABES LINK melekat pada `ServiceCase` dan ditujukan kepada PIC internal untuk membuat/mengonfirmasi janji | Batas dengan reminder CAKRA perlu verifikasi internal    |
| Janji                 | Form memilih referensi existing dan menyimpan konteks janji pada record yang sama; `NEEDS_SCHEDULING` tidak dianggap `CONFIRMED` | Integrasi kalender/CAKRA tidak diasumsikan               |
| Kendali layanan       | `ServiceCase` menyatukan kasus in-branch/out-branch sampai ditutup dan memisahkan penyelesaian dari penggunaan     | Fokus implementasi MABES LINK                            |
| Lokasi/foto           | Metadata tambahan pada referensi yang sama; foto privat hanya untuk mengenali tempat                               | Kebijakan data/lokasi organisasi wajib disetujui         |
| Batas wilayah peta    | Overlay referensi administratif Mangga Besar untuk filter/fokus; tidak membuat lead, visit, atau skor baru         | Cakupan wilayah kerja cabang wajib dikonfirmasi internal |

## Kontrol teknis

- `ServiceCase.prospectId` memakai foreign key ke record existing; pekerjaan, peta, foto, visit, follow-up, handover, dan penggunaan tidak membuat tabel master prospek baru.
- Pasangan `sourceSystem` + `sourceReference` pada `ServiceCase` unik untuk mencegah duplikasi referensi sumber yang sama.
- `cakraReference` pada `Prospect` unik dan opsional.
- UI pekerjaan memilih referensi existing dan tidak meminta identitas/kebutuhan dasar diinput ulang.
- Form janji boleh memperbarui kontak yang ditemui, alias toko opsional, dan lokasi pada record existing melalui kontrol versi/audit; form tidak membuat lead baru.
- Menu Mapping membaca record `Prospect` yang sama dan hanya menampilkan record dengan `UsageVerification=VERIFIED`; pencarian/filter, marker, sumber/waktu lokasi, dan foto tidak membentuk master lead atau master lokasi kedua.
- API pembuatan prospek manual mengembalikan `MANUAL_REFERENCE_DISABLED` kecuali flag server secara eksplisit diaktifkan.
- Tidak ada endpoint, token, scraper, atau kredensial CAKRA/Kopra/core banking di repo.
- Seeder role khusus testing tidak membuat lead/prospek, visit, pipeline, atau reminder CAKRA. Seeder menolak database operasional, hanya membuat empat akun domain `.test` pada database yang namanya mengandung `test`, dan kredensialnya hanya ditulis ke `role.md` yang diabaikan Git.
- Tidak ada seeder data bisnis, kredensial demo pada UI, integrasi, atau sinkronisasi CAKRA di repo. Fixture tes lain dibuat sementara oleh suite tes dan dibersihkan setelah pemeriksaan.
- ADMIN mempunyai cakupan aplikasi lintas cabang, tetapi flag ini tidak memberi akses ke CAKRA/core banking dan bukan pengganti kewenangan sistem sumber.

## Keputusan yang belum terbukti

Sebelum penggunaan data nyata, pemilik proses/sistem perlu menentukan: sistem master untuk lead dan kunjungan; mekanisme link/import yang diizinkan; data minimum yang boleh disalin; retensi; rekonsiliasi duplikasi; serta apakah reminder CAKRA sudah mencukupi. Sampai keputusan itu ada, repo tidak mengklaim kebaruan, integrasi, atau ketiadaan kemampuan serupa di Mandiri.
