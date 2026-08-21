param(
    [Parameter(Mandatory = $true)]
    [string]$Password,
    [string]$User = "postgres",
    [string]$Database = "intelligent_log_forensics",
    [int]$Port = 5432
)

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    $candidate = Get-ChildItem "C:\Program Files\PostgreSQL" -Filter psql.exe -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $candidate) {
        throw "psql.exe was not found. Install PostgreSQL 17 or add its bin directory to PATH."
    }
    $psqlPath = $candidate.FullName
} else {
    $psqlPath = $psql.Source
}

$env:PGPASSWORD = $Password
try {
    $exists = & $psqlPath -h localhost -p $Port -U $User -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$Database'"
    if ($LASTEXITCODE -ne 0) {
        throw "Could not connect to PostgreSQL. Check the username, password, and port."
    }
    if ($exists.Trim() -ne "1") {
        & $psqlPath -h localhost -p $Port -U $User -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $Database"
        if ($LASTEXITCODE -ne 0) { throw "Database creation failed." }
        Write-Host "Created database '$Database'."
    } else {
        Write-Host "Database '$Database' already exists."
    }

    $encodedPassword = [uri]::EscapeDataString($Password)
    $envPath = Join-Path $PSScriptRoot "..\.env"
    $content = @(
        "FLASK_APP=run.py"
        "SECRET_KEY=change-this-secret-key"
        "DATABASE_URL=postgresql+psycopg2://${User}:${encodedPassword}@localhost:${Port}/${Database}"
        "UPLOAD_FOLDER=instance/uploads"
        "REPORT_FOLDER=instance/reports"
        "MAX_CONTENT_LENGTH=104857600"
    )
    Set-Content -LiteralPath $envPath -Value $content -Encoding utf8
    Write-Host "Wrote PostgreSQL configuration to .env."
    Write-Host "Run 'python run.py' to create tables and start the application."
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
