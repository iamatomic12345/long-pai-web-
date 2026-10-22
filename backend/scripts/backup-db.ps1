<#
  Back up the Long Pai database (the public schema on Supabase) to a dated .sql file.

  Usage (PowerShell, from the repo root):
    powershell -ExecutionPolicy Bypass -File backend\scripts\backup-db.ps1

  It asks for the connection string without echoing it (or reads $env:DATABASE_URL if set).
  Needs pg_dump from PostgreSQL client tools of the same or newer major version as Supabase.
  Output: C:\Users\thiti\Downloads\longpai-backups\longpai-YYYY-MM-DD_HHmm.sql (override with -OutDir)

  Restore (replaces the tables in the public schema with the backup):
    psql "<connection string>" -v ON_ERROR_STOP=1 -f <file>.sql
#>
param(
  [string]$OutDir = "$env:USERPROFILE\Downloads\longpai-backups"
)
$ErrorActionPreference = "Stop"

# pg_dump on PATH, or the newest one from the PostgreSQL installer
$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgDump) {
  $pgDump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [int]$_.Directory.Parent.Name } -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $pgDump) {
  Write-Error "pg_dump not found. Install the PostgreSQL command line tools (https://www.postgresql.org/download/windows/) and try again."
}

$url = $env:DATABASE_URL
if (-not $url) {
  $secure = Read-Host "Supabase connection string (Session pooler URI; input is hidden)" -AsSecureString
  $url = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
if (-not $url) { Write-Error "No connection string given." }

# the app's ?sslmode=no-verify is a node-postgres setting; libpq (pg_dump) calls it "require"
$url = $url -replace "sslmode=no-verify", "sslmode=require"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$file = Join-Path $OutDir ("longpai-{0}.sql" -f (Get-Date -Format "yyyy-MM-dd_HHmm"))

# public schema only (Supabase's own auth/storage schemas aren't ours to restore);
# --clean --if-exists makes the file drop and recreate each table when restored
& $pgDump --dbname="$url" --schema=public --no-owner --no-privileges --clean --if-exists --file="$file"
if ($LASTEXITCODE -ne 0) {
  Remove-Item -ErrorAction SilentlyContinue $file
  Write-Error "pg_dump failed (exit $LASTEXITCODE). If it mentions a server version mismatch, install a newer PostgreSQL client."
}

$size = [math]::Round((Get-Item $file).Length / 1KB, 1)
Write-Host "Backup written: $file ($size KB)"
