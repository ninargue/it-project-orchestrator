<#
.SYNOPSIS
    Validador mecánico y determinista para migraciones y scripts SQL de base de datos.
.DESCRIPTION
    Inspecciona archivos .up.sql y .down.sql o un directorio de migraciones para validar:
    1. Simetría obligatoria up.sql <-> down.sql.
    2. Creación de índices en todas las claves foráneas (FKs).
    3. Habilitación de Row-Level Security (RLS) en tablas de aplicación.
    4. Detección de operaciones DDL bloqueantes (ADD COLUMN NOT NULL sin DEFAULT).
    5. Detección de columnas sensibles (PII/Secretos) sin hash o protección.
.PARAMETER MigrationsDir
    Ruta a la carpeta que contiene los scripts SQL o archivo específico a validar.
.EXAMPLE
    .\scripts\validate-db-migrations.ps1 -MigrationsDir "database/migrations"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$MigrationsDir = "database/migrations",

    [Parameter(Mandatory = $false)]
    [string]$Engine = "postgres"
)

$ErrorActionPreference = "Stop"
$failures = @()
$warnings = @()
$passedChecks = @()

Write-Host "🔍 Iniciando validación mecánica determinista de migraciones SQL..." -ForegroundColor Cyan
Write-Host "Directorio: $MigrationsDir | Motor: $Engine`n"

if (-not (Test-Path $MigrationsDir)) {
    Write-Warning "El directorio '$MigrationsDir' no existe todavía. Se omite validación hasta generar código."
    exit 0
}

$upFiles = Get-ChildItem -Path $MigrationsDir -Filter "*.up.sql" -File
$downFiles = Get-ChildItem -Path $MigrationsDir -Filter "*.down.sql" -File

if ($upFiles.Count -eq 0) {
    Write-Host "ℹ️ No se encontraron archivos *.up.sql en '$MigrationsDir'." -ForegroundColor Yellow
    exit 0
}

# 1. Chequeo de Simetría Up / Down
foreach ($upFile in $upFiles) {
    $baseName = $upFile.Name -replace '\.up\.sql$', ''
    $expectedDownName = "$baseName.down.sql"
    $matchingDown = $downFiles | Where-Object { $_.Name -eq $expectedDownName }

    if (-not $matchingDown) {
        $failures += "❌ [SIMETRÍA]: Falta el archivo de rollback correspondiente '$expectedDownName' para '$($upFile.Name)'."
    } else {
        $passedChecks += "✅ [SIMETRÍA]: Pareja simétrica detectada: $($upFile.Name) <-> $expectedDownName"

        # Verificar que las tablas creadas en UP se borren en DOWN
        $upContent = Get-Content -Path $upFile.FullName -Raw
        $downContent = Get-Content -Path $matchingDown.FullName -Raw

        $createdTables = [regex]::Matches($upContent, 'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase) | ForEach-Object { $_.Groups[1].Value.Split('.')[-1].Trim('`"[]') }
        
        foreach ($tbl in $createdTables) {
            $dropPattern = "DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:[a-zA-Z0-9_\.]+\.)?$tbl\b"
            if ($downContent -notmatch $dropPattern) {
                $failures += "❌ [REVERSIBILIDAD]: La tabla '$tbl' se crea en $($upFile.Name) pero no tiene DROP TABLE en $($matchingDown.Name)."
            } else {
                $passedChecks += "✅ [REVERSIBILIDAD]: Tabla '$tbl' correctamente eliminada en $($matchingDown.Name)."
            }
        }
    }
}

# 2. Análisis de contenido en archivos UP
foreach ($upFile in $upFiles) {
    $content = Get-Content -Path $upFile.FullName -Raw
    $fileName = $upFile.Name

    # A. Índices en Foreign Keys
    # Detecta patterns: REFERENCES tabla(col) o FOREIGN KEY (col) REFERENCES
    $fkMatches = [regex]::Matches($content, '(?:\b([a-zA-Z0-9_]+)\s+[a-zA-Z0-9_\(\)]+)?\s+REFERENCES\s+([a-zA-Z0-9_\.]+)\s*\(([a-zA-Z0-9_]+)\)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    
    foreach ($m in $fkMatches) {
        $fkCol = $m.Groups[1].Value
        $targetTable = $m.Groups[2].Value
        
        # Si fue sintaxis inline: campo ... REFERENCES tabla(id)
        if ($fkCol -and $fkCol -notmatch 'FOREIGN|CONSTRAINT') {
            $indexPattern = "CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[a-zA-Z0-9_]+\s+ON\s+[a-zA-Z0-9_\.]+\s*\([^\)]*\b$fkCol\b[^\)]*\)"
            if ($content -notmatch $indexPattern) {
                $failures += "❌ [MISSING INDEX]: La clave foránea en columna '$fkCol' (referenciando a '$targetTable') en '$fileName' no tiene un CREATE INDEX asociado."
            } else {
                $passedChecks += "✅ [INDEX FK]: Índice detectado para clave foránea '$fkCol' en '$fileName'."
            }
        }
    }

    # B. Detección de Operaciones Bloqueantes Destructivas
    $blockingAddCol = [regex]::Matches($content, 'ALTER\s+TABLE\s+[a-zA-Z0-9_\.]+\s+ADD\s+(?:COLUMN\s+)?[a-zA-Z0-9_]+\s+[^;]+?\bNOT\s+NULL\b', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($blk in $blockingAddCol) {
        if ($blk.Value -notmatch '\bDEFAULT\b') {
            $warnings += "⚠️ [OPERACIÓN BLOQUEANTE]: Sentencia '$($blk.Value.Trim())' en '$fileName' agrega una columna NOT NULL sin valor DEFAULT. Esto puede bloquear tablas en caliente."
        }
    }

    # C. Verificación de RLS en Postgres
    if ($Engine -eq "postgres" -or $Engine -eq "supabase") {
        $createdTables = [regex]::Matches($content, 'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase) | ForEach-Object { $_.Groups[1].Value.Split('.')[-1].Trim('`"[]') }
        foreach ($tbl in $createdTables) {
            # Tablas técnicas como migraciones o logs pueden quedar exentas si se nombran específicamente
            if ($tbl -match '^(__|schema_migrations|pg_)') { continue }

            $rlsPattern = "ALTER\s+TABLE\s+(?:[a-zA-Z0-9_\.]+\.)?$tbl\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY"
            if ($content -notmatch $rlsPattern) {
                # Buscamos también en archivos de seguridad anexos si existen
                $securityFiles = Get-ChildItem -Path "database/security" -Filter "*.sql" -File -ErrorAction SilentlyContinue
                $foundInSecurity = $false
                foreach ($sf in $securityFiles) {
                    if ((Get-Content $sf.FullName -Raw) -match $rlsPattern) {
                        $foundInSecurity = $true
                        break
                    }
                }

                if (-not $foundInSecurity) {
                    $warnings += "⚠️ [RLS]: La tabla '$tbl' creada en '$fileName' no tiene un comando 'ENABLE ROW LEVEL SECURITY' explícito en la migración ni en database/security/."
                } else {
                    $passedChecks += "✅ [RLS]: RLS habilitado para tabla '$tbl' en scripts de seguridad."
                }
            } else {
                $passedChecks += "✅ [RLS]: RLS habilitado directamente para tabla '$tbl' en '$fileName'."
            }
        }
    }

    # D. Detección de Datos Sensibles (PII / Secrets)
    $sensitiveMatches = [regex]::Matches($content, '\b(password|passwd|contrasena|token|secret|tarjeta|credit_card|cvv|ssn)\b\s+([a-zA-Z0-9_]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($sm in $sensitiveMatches) {
        $colName = $sm.Groups[1].Value
        $type = $sm.Groups[2].Value
        if ($type -match '^(VARCHAR|TEXT|CHAR)$' -and $content -notmatch '(?i)hash|cifrado|encrypt|argon2|bcrypt') {
            $warnings += "⚠️ [PII / COMPLIANCE]: Columna sensible sospechosa '$colName' con tipo plano '$type' en '$fileName'. Verificar si debe almacenar hash (bcrypt/argon2) o cifrado."
        }
    }
}

# --- REPORTE FINAL ---
Write-Host "==================================================" -ForegroundColor DarkGray
Write-Host "📊 REPORTE DE VALIDACIÓN MECÁNICA DE BASE DE DATOS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor DarkGray

if ($passedChecks.Count -gt 0) {
    Write-Host "`n✅ CHEQUEOS DETERMINISTAS SUPERADOS ($($passedChecks.Count)):" -ForegroundColor Green
    foreach ($p in $passedChecks) { Write-Host "   $p" -ForegroundColor Green }
}

if ($warnings.Count -gt 0) {
    Write-Host "`n⚠️ ADVERTENCIAS DE CALIDAD/SEGURIDAD ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($w in $warnings) { Write-Host "   $w" -ForegroundColor Yellow }
}

if ($failures.Count -gt 0) {
    Write-Host "`n❌ ERRORES BLOQUEANTES DETECTADOS ($($failures.Count)):" -ForegroundColor Red
    foreach ($f in $failures) { Write-Host "   $f" -ForegroundColor Red }
    Write-Host "`n🛑 La validación mecánica ha FALLADO. Corrige los errores antes de avanzar." -ForegroundColor Red
    exit 1
} else {
    Write-Host "`n🎉 Validación mecánica superada con ÉXITO. Código listo para auditoría de QA y revisión humana." -ForegroundColor Green
    exit 0
}
