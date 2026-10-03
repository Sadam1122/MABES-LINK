param([Parameter(Mandatory=$true)][string]$Name, [switch]$ConfirmRestore)
$ErrorActionPreference = "Stop"
if (-not $ConfirmRestore) { throw "Restore mengubah database. Jalankan ulang dengan -ConfirmRestore setelah backup diverifikasi." }
if ($Name -notmatch '^[A-Za-z0-9_-]+$') { throw "Nama backup tidak valid." }
if (-not (Test-Path -LiteralPath ".\$Name.dump")) { throw "File .\$Name.dump tidak ditemukan." }
docker compose -f docker-compose.production.yml cp ".\$Name.dump" "postgres:/backups/$Name.dump"
docker compose -f docker-compose.production.yml exec -T postgres sh -c "test -f /backups/$Name.dump && pg_restore --clean --if-exists --no-owner -U `$POSTGRES_USER -d `$POSTGRES_DB /backups/$Name.dump"
if (Test-Path -LiteralPath ".\$Name-uploads.tar.gz") {
  docker compose -f docker-compose.production.yml cp ".\$Name-uploads.tar.gz" "web:/tmp/$Name-uploads.tar.gz"
  docker compose -f docker-compose.production.yml exec -T web sh -c "tar -xzf /tmp/$Name-uploads.tar.gz -C /data"
} else {
  Write-Warning "Arsip foto tidak ditemukan; hanya database yang dipulihkan. Metadata foto dapat menunjuk ke file yang belum tersedia."
}
Write-Output "Restore database selesai. Jalankan pemeriksaan health, migration status, dan uji akses sebelum membuka layanan."
