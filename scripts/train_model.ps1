# PowerShell script to train the emergency prediction model
# Usage (PowerShell):
#   powershell -ExecutionPolicy Bypass -File \
#     C:\Users\User\Desktop\FIles\dashboardproject\capstoneproject\scripts\train_model.ps1

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $projectDir

# Resolve Python executable
$pythonCandidates = @(
    Join-Path $projectRoot "venv\Scripts\python.exe"),
    "python",
    "py -3",
    "py"

$pythonExe = $null
foreach ($p in $pythonCandidates) {
    try {
        $version = & $p -V 2>$null
        if ($LASTEXITCODE -eq 0) { $pythonExe = $p; break }
    } catch {}
}

if (-not $pythonExe) {
    Write-Host "Python not found. Ensure Python is installed or venv exists." -ForegroundColor Red
    exit 1
}

# Change to project root (where manage.py lives)
Set-Location $projectRoot

# Create log file path
$logPath = Join-Path $projectRoot "train_log.txt"

# Run migrations (no-op if already applied)
try {
    & $pythonExe manage.py migrate | Tee-Object -FilePath $logPath -Append
} catch {}

# Run training command and append output to log
& $pythonExe manage.py train_emergency_model | Tee-Object -FilePath $logPath -Append

# Exit with last command's exit code
exit $LASTEXITCODE 