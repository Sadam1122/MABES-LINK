param([string]$Name = (Get-Date -Format "yyyyMMdd-HHmmss"), [string]$EnvFile = ".env.production")
$ErrorActionPreference = "Stop"
if ($Name -notmatch '^[A-Za-z0-9_-]+$') { throw "Nama backup tidak valid." }
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) { throw "Environment deployment tidak ditemukan." }
if ((Test-Path -LiteralPath ".\$Name.dump") -or (Test-Path -LiteralPath ".\$Name-uploads.tar.gz")) { throw "Nama backup sudah dipakai. Pilih nama baru agar backup lama tidak tertimpa." }
docker compose --env-file $EnvFile -f docker-compose.production.yml exec -T postgres sh -c "pg_dump -Fc -U `$POSTGRES_USER -d `$POSTGRES_DB > /backups/$Name.dump"
if ($LASTEXITCODE -ne 0) { throw "Backup PostgreSQL gagal." }
docker compose --env-file $EnvFile -f docker-compose.production.yml cp "postgres:/backups/$Name.dump" ".\$Name.dump"
if ($LASTEXITCODE -ne 0) { throw "Salinan backup PostgreSQL gagal." }
docker compose --env-file $EnvFile -f docker-compose.production.yml exec -T web sh -c "tar -czf /tmp/$Name-uploads.tar.gz -C /data uploads"
if ($LASTEXITCODE -ne 0) { throw "Backup storage gagal." }
docker compose --env-file $EnvFile -f docker-compose.production.yml cp "web:/tmp/$Name-uploads.tar.gz" ".\$Name-uploads.tar.gz"
if ($LASTEXITCODE -ne 0) { throw "Salinan backup storage gagal." }
Write-Output "Backup database tersimpan pada volume backups dan lokal: $Name.dump"
Write-Output "Backup foto tersimpan lokal: $Name-uploads.tar.gz"
