param([Parameter(Mandatory=$true)][string]$Name, [switch]$ConfirmRestore, [string]$EnvFile = ".env.production")
$ErrorActionPreference = "Stop"
if (-not $ConfirmRestore) { throw "Restore mengubah database. Jalankan ulang dengan -ConfirmRestore setelah backup diverifikasi." }
if ($Name -notmatch '^[A-Za-z0-9_-]+$') { throw "Nama backup tidak valid." }
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) { throw "Environment deployment tidak ditemukan." }
if (-not (Test-Path -LiteralPath ".\$Name.dump")) { throw "File .\$Name.dump tidak ditemukan." }
docker compose --env-file $EnvFile -f docker-compose.production.yml cp ".\$Name.dump" "postgres:/backups/$Name.dump"
if ($LASTEXITCODE -ne 0) { throw "Menyalin arsip restore gagal." }
docker compose --env-file $EnvFile -f docker-compose.production.yml exec -T postgres sh -c "test -f /backups/$Name.dump && pg_restore --single-transaction --exit-on-error --clean --if-exists --no-owner -U `$POSTGRES_USER -d `$POSTGRES_DB /backups/$Name.dump"
if ($LASTEXITCODE -ne 0) { throw "Restore PostgreSQL gagal. Layanan belum boleh dibuka." }
if (Test-Path -LiteralPath ".\$Name-uploads.tar.gz") {
  docker compose --env-file $EnvFile -f docker-compose.production.yml cp ".\$Name-uploads.tar.gz" "web:/tmp/$Name-uploads.tar.gz"
  if ($LASTEXITCODE -ne 0) { throw "Salinan arsip storage gagal." }
  docker compose --env-file $EnvFile -f docker-compose.production.yml exec -T web sh -c "tar -xzf /tmp/$Name-uploads.tar.gz -C /data"
  if ($LASTEXITCODE -ne 0) { throw "Restore storage gagal. Periksa arsip dan izin volume." }
} else {
  Write-Warning "Arsip foto tidak ditemukan; hanya database yang dipulihkan. Metadata foto dapat menunjuk ke file yang belum tersedia."
}
Write-Output "Restore database selesai. Jalankan pemeriksaan health, migration status, dan uji akses sebelum membuka layanan."
