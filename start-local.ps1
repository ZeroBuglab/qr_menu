$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeDir = "C:\Program Files\nodejs"
$pnpm = "C:\Users\$env:USERNAME\AppData\Roaming\npm\pnpm.cmd"
$postgresBin = "C:\Program Files\PostgreSQL\16\bin"
$dbData = Join-Path $repoRoot ".local-postgres"

if (-not (Test-Path $pnpm)) { throw "pnpm не найден. Установите Node.js LTS и выполните npm install --global pnpm@9.15.4" }
$env:Path = "$nodeDir;$postgresBin;$(Split-Path $pnpm);$env:Path"
$env:DATABASE_URL = "postgresql://qrmenu@localhost:5433/qrmenu?schema=public"

if (Test-Path (Join-Path $dbData "PG_VERSION")) {
  & pg_ctl.exe status -D $dbData *> $null
  if ($LASTEXITCODE -ne 0) { & pg_ctl.exe -D $dbData -o '"-p 5433"' -l (Join-Path $dbData "server.log") start }
}

Set-Location $repoRoot
& $pnpm --filter @qr-menu/database prisma db push --skip-generate
if ($LASTEXITCODE -ne 0) { throw "Не удалось применить Prisma schema" }
& $pnpm --filter @qr-menu/database seed

Start-Process powershell.exe -WorkingDirectory $repoRoot -ArgumentList @("-NoExit", "-Command", "& '$pnpm' --filter @qr-menu/api dev")
Start-Process powershell.exe -WorkingDirectory $repoRoot -ArgumentList @("-NoExit", "-Command", "& '$pnpm' --filter @qr-menu/web dev")
Start-Process "http://localhost:3000/menu/coffee-house?table=12"
Write-Host "Web: http://localhost:3000/menu/coffee-house?table=12" -ForegroundColor Green
Write-Host "API: http://localhost:4000/health" -ForegroundColor Green
