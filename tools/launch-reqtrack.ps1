# ReqTrack launcher.
# 起動するとリポジトリ直下に移動し, `pnpm dev` で backend + frontend を並列起動する。
# 数秒後に既定ブラウザで http://localhost:5174 を開く。
# このウィンドウを閉じると両サーバが停止する。
#
# ポートは DGMS(5173/8787) と衝突しないよう frontend=5174 / backend=8788 を使用。

$ErrorActionPreference = "Continue"
$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path "$repoRoot\package.json")) {
    Write-Host "[reqtrack] package.json not found at $repoRoot" -ForegroundColor Red
    Pause
    exit 1
}

Set-Location $repoRoot

# 初回起動時は dependencies が未インストールの可能性があるので install を行う。
if (-not (Test-Path "$repoRoot\node_modules")) {
    Write-Host "[reqtrack] node_modules not found -- running pnpm install..." -ForegroundColor Yellow
    pnpm install
}

# backend は dev.db の migration が必要 (CI と同じ)。
# 毎回 migrate deploy を走らせる: 初回は dev.db を作成し全 migration を適用,
# 2 回目以降は pending な migration だけを適用する (idempotent)。
Write-Host "[reqtrack] applying Prisma migrations (idempotent)..." -ForegroundColor Yellow
pnpm --filter @reqtrack/backend exec prisma migrate deploy

# ブラウザを別ジョブで遅延起動 (5 秒後に dev サーバが立ち上がっている想定)
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 5
    Start-Process "http://localhost:5174"
} | Out-Null

Write-Host "[reqtrack] starting backend (8788) + frontend (5174)... close this window to stop" -ForegroundColor Cyan
Write-Host ""

# foreground で並列起動 -- ウィンドウを閉じると Ctrl+C 同様に両サーバが落ちる
pnpm dev
