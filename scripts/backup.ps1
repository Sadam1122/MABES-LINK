param([string]$Name = (Get-Date -Format "yyyyMMdd-HHmmss"))
$ErrorActionPreference = "Stop"
if ($Name -notmatch '^[A-Za-z0-9_-]+$') { throw "Nama backup tidak valid." }
docker compose -f docker-compose.production.yml exec -T postgres sh -c "pg_dump -Fc -U `$POSTGRES_USER -d `$POSTGRES_DB > /backups/$Name.dump"
docker compose -f docker-compose.production.yml cp "postgres:/backups/$Name.dump" ".\$Name.dump"
docker compose -f docker-compose.production.yml exec -T web sh -c "tar -czf /tmp/$Name-uploads.tar.gz -C /data uploads"
docker compose -f docker-compose.production.yml cp "web:/tmp/$Name-uploads.tar.gz" ".\$Name-uploads.tar.gz"
Write-Output "Backup database tersimpan pada volume backups dan lokal: $Name.dump"
Write-Output "Backup foto tersimpan lokal: $Name-uploads.tar.gz"
