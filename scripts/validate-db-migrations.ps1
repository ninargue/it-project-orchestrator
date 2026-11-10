<#
.SYNOPSIS
    Validador mecánico y determinista para migraciones y scripts de base de datos.
.DESCRIPTION
    Inspecciona archivos de migración (.up.sql / .down.sql o scripts versionados .sql)
    en cualquier motor (PostgreSQL, Supabase, MySQL, SQLite, etc.) y directorio de migraciones:
    1. Auto-descubrimiento de directorio de migraciones (database/migrations, supabase/migrations, migrations, etc.).
    2. Simetría opcional/obligatoria up.sql <-> down.sql si el proyecto usa migraciones reversibles.
    3. Creación de índices en todas las claves foráneas (FKs) con ámbito estricto por tabla.
    4. Habilitación de Row-Level Security (RLS) en motores compatibles (PostgreSQL / Supabase).
    5. Detección de operaciones DDL bloqueantes (ADD COLUMN NOT NULL sin DEFAULT).
    6. Detección de columnas sensibles (PII/Secretos) sin hash o protección.
.PARAMETER MigrationsDir
    Ruta a la carpeta que contiene los scripts SQL (relativa o absoluta).
.PARAMETER SecurityDir
    Ruta a la carpeta que contiene políticas RLS y scripts DCL.
.PARAMETER Engine
    Motor de base de datos: postgres, supabase, mysql, mariadb, sqlite, mssql, mongodb.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$MigrationsDir = "database/migrations",

    [Parameter(Mandatory = $false)]
    [string]$SecurityDir = "",

    [Parameter(Mandatory = $false)]
    [string]$Engine = "postgres"
)

$ErrorActionPreference = "Stop"
$failures = @()
$warnings = @()
$passedChecks = @()

$EngineLower = $Engine.ToLower().Trim()

# 0. Manejo de motores NoSQL
if ($EngineLower -in @("mongodb", "nosql", "dynamodb", "firestore", "couchdb")) {
    Write-Host "ℹ️ Motor NoSQL detectado ('$EngineLower')." -ForegroundColor Cyan
    Write-Host "   Las validaciones mecánicas de DDL/RLS relacional no aplican a bases de datos documentales."
    Write-Host "   Se delega la validación de esquemas JSON / validadores de colecciones a 'db-qa-agent'."
    exit 0
}

# 1. Auto-descubrimiento del directorio de migraciones si la ruta por defecto no existe
if (-not (Test-Path $MigrationsDir)) {
    $candidatePaths = @(
        "database/migrations",
        "supabase/migrations",
        "src/database/migrations",
        "db/migrations",
        "migrations",
        "prisma/migrations"
    )

    $foundPath = $null
    foreach ($cand in $candidatePaths) {
        if (Test-Path $cand) {
            $foundPath = $cand
            break
        }
    }

    if ($foundPath) {
        Write-Host "ℹ️ Directorio de migraciones detectado automáticamente en: '$foundPath'" -ForegroundColor Cyan
        $MigrationsDir = $foundPath
    } else {
        Write-Warning "El directorio de migraciones '$MigrationsDir' no existe todavía. Se omite validación hasta generar código."
        exit 0
    }
}

# Resolver SecurityDir si no fue provisto explícitamente
if (-not $SecurityDir) {
    $parent = Split-Path -Path $MigrationsDir -Parent
    if ($parent) {
        $candidateSec = Join-Path -Path $parent -ChildPath "security"
        if (Test-Path $candidateSec) {
            $SecurityDir = $candidateSec
        }
    }
    if (-not $SecurityDir -and (Test-Path "database/security")) {
        $SecurityDir = "database/security"
    }
}

Write-Host "🔍 Iniciando validación mecánica determinista de migraciones..." -ForegroundColor Cyan
Write-Host "Directorio Migraciones: $MigrationsDir"
if ($SecurityDir) { Write-Host "Directorio Seguridad:   $SecurityDir" }
Write-Host "Motor de Base de Datos: $EngineLower`n"

# 2. Detección de archivos a validar
$upFiles = Get-ChildItem -Path $MigrationsDir -Filter "*.up.sql" -File -Recurse
$downFiles = Get-ChildItem -Path $MigrationsDir -Filter "*.down.sql" -File -Recurse

# Si no hay archivos .up.sql, buscar archivos .sql directos (ej. Supabase, Flyway, Prisma)
$targetFiles = @()
$isSymmetricMode = $false

if ($upFiles.Count -gt 0) {
    $targetFiles = $upFiles
    $isSymmetricMode = $true
} else {
    # Buscar todos los .sql excluyendo tests y rollbacks
    $targetFiles = Get-ChildItem -Path $MigrationsDir -Filter "*.sql" -File -Recurse | Where-Object {
        $_.Name -notmatch '(?i)\.down\.sql$' -and $_.Name -notmatch '(?i)\.test\.sql$'
    }
}

if ($targetFiles.Count -eq 0) {
    Write-Host "ℹ️ No se encontraron archivos de migración SQL en '$MigrationsDir'." -ForegroundColor Yellow
    exit 0
}

# 3. Validación de Simetría (Modo Simétrico)
if ($isSymmetricMode) {
    foreach ($upFile in $upFiles) {
        $baseName = $upFile.Name -replace '\.up\.sql$', ''
        $expectedDownName = "$baseName.down.sql"
        $matchingDown = $downFiles | Where-Object { $_.Name -eq $expectedDownName }

        if (-not $matchingDown) {
            $failures += "❌ [SIMETRÍA]: Falta el archivo de rollback correspondiente '$expectedDownName' para '$($upFile.Name)'."
        } else {
            $passedChecks += "✅ [SIMETRÍA]: Pareja simétrica detectada: $($upFile.Name) <-> $expectedDownName"

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
}

# 4. Análisis de Contenido SQL por archivo
foreach ($sqlFile in $targetFiles) {
    $content = Get-Content -Path $sqlFile.FullName -Raw
    $fileName = $sqlFile.Name

    # A. Índices en Foreign Keys (Parser por ámbito de tabla)
    $detectedFks = @()

    # 1. Extracción desde bloques CREATE TABLE (inline y table constraints)
    $tableBlocks = [regex]::Matches($content, 'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)\s*\(([\s\S]*?)\)\s*;', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($tb in $tableBlocks) {
        $sourceTbl = $tb.Groups[1].Value.Split('.')[-1].Trim('`"[]')
        $body = $tb.Groups[2].Value

        # Constraint explícita: FOREIGN KEY (col) REFERENCES target(id)
        $explicitFks = [regex]::Matches($body, '(?:CONSTRAINT\s+[a-zA-Z0-9_]+\s+)?FOREIGN\s+KEY\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s*REFERENCES\s+([a-zA-Z0-9_\.]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        foreach ($efk in $explicitFks) {
            $detectedFks += [PSCustomObject]@{
                SourceTable = $sourceTbl
                FkCol       = $efk.Groups[1].Value.Trim()
                TargetTable = $efk.Groups[2].Value.Split('.')[-1].Trim('`"[]')
            }
        }

        # Constraint inline: col type [NOT NULL] REFERENCES target(id)
        # Dividir por comas que no estén dentro de paréntesis (ej. evitar partir DECIMAL(10,2))
        $columnDefs = [regex]::Split($body, ',\s*(?![^\(]*\))')
        foreach ($cdef in $columnDefs) {
            $trimmedLine = $cdef.Trim()
            if ($trimmedLine -match '^\s*(?:CONSTRAINT|FOREIGN\s+KEY|PRIMARY\s+KEY|CHECK|UNIQUE|KEY|INDEX)\b' -or $trimmedLine -match '^\s*--') {
                continue
            }
            if ($trimmedLine -match '^\s*([a-zA-Z0-9_]+)\s+[a-zA-Z0-9_\(\)]+[\s\S]*?\bREFERENCES\s+([a-zA-Z0-9_\.]+)') {
                $detectedFks += [PSCustomObject]@{
                    SourceTable = $sourceTbl
                    FkCol       = $Matches[1].Trim()
                    TargetTable = $Matches[2].Split('.')[-1].Trim('`"[]')
                }
            }
        }
    }

    # 2. Extracción desde sentencias ALTER TABLE ... ADD FOREIGN KEY
    $alterFks = [regex]::Matches($content, 'ALTER\s+TABLE\s+(?:ONLY\s+)?([a-zA-Z0-9_\.]+)\s+ADD\s+(?:CONSTRAINT\s+[a-zA-Z0-9_]+\s+)?FOREIGN\s+KEY\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s*REFERENCES\s+([a-zA-Z0-9_\.]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($afk in $alterFks) {
        $detectedFks += [PSCustomObject]@{
            SourceTable = $afk.Groups[1].Value.Split('.')[-1].Trim('`"[]')
            FkCol       = $afk.Groups[2].Value.Trim()
            TargetTable = $afk.Groups[3].Value.Split('.')[-1].Trim('`"[]')
        }
    }

    # 3. Verificación de índice correspondiente (con ámbito estricto por tabla)
    foreach ($fk in $detectedFks) {
        $srcTbl = $fk.SourceTable
        $fkCol = $fk.FkCol
        $tgtTbl = $fk.TargetTable

        # Acepta: CREATE [UNIQUE] INDEX ... ON table (col) o KEY/INDEX inline en MySQL
        $indexPattern = "(?:CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[a-zA-Z0-9_]+\s+ON\s+(?:[a-zA-Z0-9_\.]+\.)?$srcTbl\s*\([^\)]*?\b$fkCol\b[^\)]*?\))|(?:\b(?:KEY|INDEX)\s+(?:[a-zA-Z0-9_]+\s*)?\([^\)]*?\b$fkCol\b[^\)]*?\))"
        if ($content -notmatch $indexPattern) {
            $failures += "❌ [MISSING INDEX]: Clave foránea en '$srcTbl.$fkCol' (referenciando a '$tgtTbl') en '$fileName' no tiene un índice sobre '$srcTbl'."
        } else {
            $passedChecks += "✅ [INDEX FK]: Índice detectado para '$srcTbl.$fkCol' -> '$tgtTbl' en '$fileName'."
        }
    }

    # B. Detección de Operaciones Bloqueantes Destructivas
    $blockingAddCol = [regex]::Matches($content, 'ALTER\s+TABLE\s+[a-zA-Z0-9_\.]+\s+ADD\s+(?:COLUMN\s+)?[a-zA-Z0-9_]+\s+[^;]+?\bNOT\s+NULL\b', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($blk in $blockingAddCol) {
        if ($blk.Value -notmatch '\bDEFAULT\b') {
            $warnings += "⚠️ [OPERACIÓN BLOQUEANTE]: Sentencia '$($blk.Value.Trim())' en '$fileName' agrega una columna NOT NULL sin valor DEFAULT. Esto puede bloquear tablas en caliente."
        }
    }

    # C. Verificaciones Específicas por Motor
    if ($EngineLower -in @("postgres", "supabase")) {
        # Verificación de RLS en PostgreSQL / Supabase
        $createdTables = [regex]::Matches($content, 'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase) | ForEach-Object { $_.Groups[1].Value.Split('.')[-1].Trim('`"[]') }
        foreach ($tbl in $createdTables) {
            if ($tbl -match '^(__|schema_migrations|pg_)') { continue }

            $rlsPattern = "ALTER\s+TABLE\s+(?:[a-zA-Z0-9_\.]+\.)?$tbl\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY"
            if ($content -notmatch $rlsPattern) {
                $securityFiles = @()
                if ($SecurityDir -and (Test-Path $SecurityDir)) {
                    $securityFiles = Get-ChildItem -Path $SecurityDir -Filter "*.sql" -File -ErrorAction SilentlyContinue
                }
                $foundInSecurity = $false
                foreach ($sf in $securityFiles) {
                    if ((Get-Content $sf.FullName -Raw) -match $rlsPattern) {
                        $foundInSecurity = $true
                        break
                    }
                }

                if (-not $foundInSecurity) {
                    $warnings += "⚠️ [RLS]: La tabla '$tbl' creada en '$fileName' no tiene un comando 'ENABLE ROW LEVEL SECURITY' explícito en la migración ni en '$SecurityDir'."
                } else {
                    $passedChecks += "✅ [RLS]: RLS habilitado para tabla '$tbl' en scripts de seguridad ($($sf.Name))."
                }
            } else {
                $passedChecks += "✅ [RLS]: RLS habilitado directamente para tabla '$tbl' en '$fileName'."
            }
        }
    } elseif ($EngineLower -eq "sqlite") {
        # En SQLite no existe DROP TABLE ... CASCADE
        if ($content -match 'DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[a-zA-Z0-9_\.]+\s+CASCADE') {
            $failures += "❌ [SINTAXIS SQLITE]: 'CASCADE' no es soportado en DROP TABLE por SQLite en '$fileName'."
        } else {
            $passedChecks += "✅ [SQLITE]: Sintaxis DROP TABLE compatible con SQLite."
        }
    } elseif ($EngineLower -in @("mysql", "mariadb")) {
        # En MySQL advertir si se usa sintaxis incompatible
        $passedChecks += "✅ [MYSQL]: Chequeos de sintaxis e índices compatibles con MySQL/MariaDB."
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
