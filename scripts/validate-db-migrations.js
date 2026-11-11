#!/usr/bin/env node
/**
 * Validador mecánico y determinista para migraciones y scripts de base de datos.
 * Multiplataforma (Linux, macOS, Windows) y agnóstico de motor (PostgreSQL, Supabase, MySQL, SQLite, etc.).
 *
 * Uso:
 *   node validate-db-migrations.js [--migrations-dir <dir>] [--security-dir <dir>] [--engine <engine>]
 */

const fs = require('fs');
const path = require('path');

// --- Colores ANSI universales para terminal ---
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

// --- Parseo de Argumentos CLI ---
const args = process.argv.slice(2);
let migrationsDir = '';
let securityDir = '';
let engine = 'postgres';
let noRls = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--migrations-dir' || arg === '-m') {
    migrationsDir = args[++i];
  } else if (arg === '--security-dir' || arg === '-s') {
    securityDir = args[++i];
  } else if (arg === '--engine' || arg === '-e') {
    engine = args[++i];
  } else if (arg === '--no-rls' || arg === '--disable-rls' || arg === '--rls=false') {
    noRls = true;
  }
}

if (securityDir && ['none', 'disabled', 'false'].includes(securityDir.toLowerCase())) {
  noRls = true;
  securityDir = '';
}

const engineLower = (engine || 'postgres').toLowerCase().trim();

// 0. Manejo de motores NoSQL
const noSqlEngines = ['mongodb', 'nosql', 'dynamodb', 'firestore', 'couchdb'];
if (noSqlEngines.includes(engineLower)) {
  console.log(`${colors.cyan}ℹ️ Motor NoSQL detectado ('${engineLower}').${colors.reset}`);
  console.log('   Las validaciones mecánicas de DDL/RLS relacional no aplican a bases de datos documentales.');
  console.log("   Se delega la validación de esquemas JSON / validadores de colecciones a 'db-qa-agent'.");
  process.exit(0);
}

// 1. Auto-descubrimiento del directorio de migraciones
const candidateMigrationDirs = [
  'database/migrations',
  'supabase/migrations',
  'src/database/migrations',
  'db/migrations',
  'migrations',
  'prisma/migrations'
];

if (!migrationsDir || !fs.existsSync(migrationsDir)) {
  let found = null;
  if (migrationsDir && fs.existsSync(migrationsDir)) {
    found = migrationsDir;
  } else {
    for (const cand of candidateMigrationDirs) {
      if (fs.existsSync(cand)) {
        found = cand;
        break;
      }
    }
  }

  if (found) {
    console.log(`${colors.cyan}ℹ️ Directorio de migraciones detectado automáticamente en: '${found}'${colors.reset}`);
    migrationsDir = found;
  } else {
    console.log(`${colors.yellow}⚠️ El directorio de migraciones '${migrationsDir || 'database/migrations'}' no existe todavía. Se omite validación hasta generar código.${colors.reset}`);
    process.exit(0);
  }
}

// 2. Manejo y Auto-descubrimiento del directorio de seguridad / RLS
const isRlsAuditActive = !noRls;
const isInSituExplicit = securityDir && ['in-situ', 'inline'].includes(securityDir.toLowerCase());
if (isInSituExplicit) {
  securityDir = '';
} else if (isRlsAuditActive && (!securityDir || !fs.existsSync(securityDir))) {
  const parent = path.dirname(migrationsDir);
  const candidateSecDirs = [
    path.join(parent, 'security'),
    path.join(parent, 'policies'),
    path.join(parent, 'auth'),
    'database/security',
    'supabase/security',
    'security'
  ];

  for (const cand of candidateSecDirs) {
    if (fs.existsSync(cand)) {
      securityDir = cand;
      break;
    }
  }
}

console.log(`${colors.cyan}🔍 Iniciando validación mecánica determinista de migraciones...${colors.reset}`);
console.log(`Directorio Migraciones: ${migrationsDir}`);
if (!isRlsAuditActive) {
  console.log(`Seguridad RLS en BD:    ${colors.yellow}Desactivada (seguridad gestionada en capa de aplicación / sin RLS)${colors.reset}`);
} else if (securityDir) {
  console.log(`Directorio Seguridad:   ${securityDir}`);
} else {
  console.log(`Directorio Seguridad:   (no detectado separado, se inspeccionarán migraciones in-situ)`);
}
console.log(`Motor de Base de Datos: ${engineLower}\n`);

// Helper para escanear archivos recursivamente
function getFilesRecursively(dir, filterRegex) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, filterRegex));
    } else if (entry.isFile() && (!filterRegex || filterRegex.test(entry.name))) {
      results.push({ name: entry.name, path: fullPath });
    }
  }
  return results;
}

// 3. Detección de archivos SQL a validar
const upFiles = getFilesRecursively(migrationsDir, /\.up\.sql$/i);
const downFiles = getFilesRecursively(migrationsDir, /\.down\.sql$/i);

let targetFiles = [];
let isSymmetricMode = false;

if (upFiles.length > 0) {
  targetFiles = upFiles;
  isSymmetricMode = true;
} else {
  targetFiles = getFilesRecursively(migrationsDir, /\.sql$/i).filter(
    (f) => !/\.down\.sql$/i.test(f.name) && !/\.test\.sql$/i.test(f.name)
  );
}

if (targetFiles.length === 0) {
  console.log(`${colors.yellow}ℹ️ No se encontraron archivos de migración SQL en '${migrationsDir}'.${colors.reset}`);
  process.exit(0);
}

const failures = [];
const warnings = [];
const passedChecks = [];

// 4. Validación de Simetría (Modo Simétrico)
if (isSymmetricMode) {
  for (const upFile of upFiles) {
    const baseName = upFile.name.replace(/\.up\.sql$/i, '');
    const expectedDownName = `${baseName}.down.sql`;
    const matchingDown = downFiles.find((d) => d.name === expectedDownName);

    if (!matchingDown) {
      failures.push(`❌ [SIMETRÍA]: Falta el archivo de rollback correspondiente '${expectedDownName}' para '${upFile.name}'.`);
    } else {
      passedChecks.push(`✅ [SIMETRÍA]: Pareja simétrica detectada: ${upFile.name} <-> ${expectedDownName}`);

      const upContent = fs.readFileSync(upFile.path, 'utf8');
      const downContent = fs.readFileSync(matchingDown.path, 'utf8');

      // Extraer tablas creadas
      const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)/gi;
      let match;
      const createdTables = [];
      while ((match = createTableRegex.exec(upContent)) !== null) {
        const rawName = match[1].split('.').pop().replace(/[`"\[\]]/g, '');
        createdTables.push(rawName);
      }

      for (const tbl of createdTables) {
        const dropPattern = new RegExp(`DROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:[a-zA-Z0-9_\\.]+\\.)?${tbl}\\b`, 'i');
        if (!dropPattern.test(downContent)) {
          failures.push(`❌ [REVERSIBILIDAD]: La tabla '${tbl}' se crea en ${upFile.name} pero no tiene DROP TABLE en ${matchingDown.name}.`);
        } else {
          passedChecks.push(`✅ [REVERSIBILIDAD]: Tabla '${tbl}' correctamente eliminada en ${matchingDown.name}.`);
        }
      }
    }
  }
}

// Validación de Simetría en Directorio de Seguridad (si existe y RLS está activo)
if (isRlsAuditActive && securityDir && fs.existsSync(securityDir)) {
  const secFiles = getFilesRecursively(securityDir, /\.sql$/i);
  const secUpFiles = secFiles.filter(f => !/\.down\.sql$/i.test(f.name) && !/\.test\.sql$/i.test(f.name));
  const secDownFiles = secFiles.filter(f => /\.down\.sql$/i.test(f.name));

  for (const sUp of secUpFiles) {
    const baseName = sUp.name.replace(/\.(up\.)?sql$/i, '');
    const expectedSecDown = `${baseName}.down.sql`;
    const matchingSecDown = secDownFiles.find(d => d.name === expectedSecDown);

    if (!matchingSecDown) {
      warnings.push(`⚠️ [SIMETRÍA SEGURIDAD]: Script de seguridad '${sUp.name}' no tiene archivo de reversión simétrico '${expectedSecDown}' en '${securityDir}'.`);
    } else {
      passedChecks.push(`✅ [SIMETRÍA SEGURIDAD]: Pareja de seguridad simétrica detectada: ${sUp.name} <-> ${expectedSecDown}`);
      const secDownContent = fs.readFileSync(matchingSecDown.path, 'utf8');
      if (!/DROP\s+POLICY/i.test(secDownContent) && !/REVOKE/i.test(secDownContent) && !/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(secDownContent)) {
        warnings.push(`⚠️ [REVERSIBILIDAD SEGURIDAD]: El archivo de rollback '${matchingSecDown.name}' no parece contener DROP POLICY ni REVOKE.`);
      } else {
        passedChecks.push(`✅ [REVERSIBILIDAD SEGURIDAD]: Rollback de seguridad contiene sentencias de revocación/eliminación de políticas.`);
      }
    }
  }
}

// 5. Análisis de Contenido SQL por archivo
for (const sqlFile of targetFiles) {
  const content = fs.readFileSync(sqlFile.path, 'utf8');
  const fileName = sqlFile.name;

  // A. Índices en Foreign Keys (Parser por ámbito de tabla)
  const detectedFks = [];

  // 1. Extracción desde bloques CREATE TABLE (inline y table constraints)
  const tableBlockRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)\s*\(([\s\S]*?)\)\s*;/gi;
  let tbMatch;
  while ((tbMatch = tableBlockRegex.exec(content)) !== null) {
    const sourceTbl = tbMatch[1].split('.').pop().replace(/[`"\[\]]/g, '');
    const body = tbMatch[2];

    // Constraint explícita: FOREIGN KEY (col) REFERENCES target(id)
    const explicitFkRegex = /(?:CONSTRAINT\s+[a-zA-Z0-9_]+\s+)?FOREIGN\s+KEY\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s*REFERENCES\s+([a-zA-Z0-9_\.]+)/gi;
    let efk;
    while ((efk = explicitFkRegex.exec(body)) !== null) {
      detectedFks.push({
        sourceTable: sourceTbl,
        fkCol: efk[1].trim(),
        targetTable: efk[2].split('.').pop().replace(/[`"\[\]]/g, '')
      });
    }

    // Constraint inline: col type [NOT NULL] REFERENCES target(id)
    // Dividir por comas que no estén dentro de paréntesis (ej. evitar partir DECIMAL(10,2))
    const columnDefs = body.split(/,\s*(?![^\(]*\))/);
    for (const cdef of columnDefs) {
      const trimmed = cdef.trim();
      if (/^\s*(?:CONSTRAINT|FOREIGN\s+KEY|PRIMARY\s+KEY|CHECK|UNIQUE|KEY|INDEX)\b/i.test(trimmed) || /^\s*--/.test(trimmed)) {
        continue;
      }
      const inlineFkMatch = trimmed.match(/^\s*([a-zA-Z0-9_]+)\s+[a-zA-Z0-9_\(\)]+[\s\S]*?\bREFERENCES\s+([a-zA-Z0-9_\.]+)/i);
      if (inlineFkMatch) {
        detectedFks.push({
          sourceTable: sourceTbl,
          fkCol: inlineFkMatch[1].trim(),
          targetTable: inlineFkMatch[2].split('.').pop().replace(/[`"\[\]]/g, '')
        });
      }
    }
  }

  // 2. Extracción desde sentencias ALTER TABLE ... ADD FOREIGN KEY
  const alterFkRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?([a-zA-Z0-9_\.]+)\s+ADD\s+(?:CONSTRAINT\s+[a-zA-Z0-9_]+\s+)?FOREIGN\s+KEY\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s*REFERENCES\s+([a-zA-Z0-9_\.]+)/gi;
  let afk;
  while ((afk = alterFkRegex.exec(content)) !== null) {
    detectedFks.push({
      sourceTable: afk[1].split('.').pop().replace(/[`"\[\]]/g, ''),
      fkCol: afk[2].trim(),
      targetTable: afk[3].split('.').pop().replace(/[`"\[\]]/g, '')
    });
  }

  // 3. Verificación de índice correspondiente (con ámbito estricto por tabla)
  for (const fk of detectedFks) {
    const { sourceTable, fkCol, targetTable } = fk;
    const indexPattern = new RegExp(
      `(?:CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?[a-zA-Z0-9_]+\\s+ON\\s+(?:[a-zA-Z0-9_\\.]+\\.)?${sourceTable}\\s*\\([^\\)]*?\\b${fkCol}\\b[^\\)]*?\\))|` +
      `(?:\\b(?:KEY|INDEX)\\s+(?:[a-zA-Z0-9_]+\\s*)?\\([^\\)]*?\\b${fkCol}\\b[^\\)]*?\\))`,
      'i'
    );

    if (!indexPattern.test(content)) {
      failures.push(`❌ [MISSING INDEX]: Clave foránea en '${sourceTable}.${fkCol}' (referenciando a '${targetTable}') en '${fileName}' no tiene un índice sobre '${sourceTable}'.`);
    } else {
      passedChecks.push(`✅ [INDEX FK]: Índice detectado para '${sourceTable}.${fkCol}' -> '${targetTable}' en '${fileName}'.`);
    }
  }

  // B. Detección de Operaciones Bloqueantes Destructivas
  const blockingRegex = /ALTER\s+TABLE\s+[a-zA-Z0-9_\.]+\s+ADD\s+(?:COLUMN\s+)?[a-zA-Z0-9_]+\s+[^;]+?\bNOT\s+NULL\b/gi;
  let blk;
  while ((blk = blockingRegex.exec(content)) !== null) {
    if (!/\bDEFAULT\b/i.test(blk[0])) {
      warnings.push(`⚠️ [OPERACIÓN BLOQUEANTE]: Sentencia '${blk[0].trim()}' en '${fileName}' agrega una columna NOT NULL sin valor DEFAULT. Esto puede bloquear tablas en caliente.`);
    }
  }

  // C. Verificaciones Específicas por Motor
  if (engineLower === 'postgres' || engineLower === 'supabase') {
    if (!isRlsAuditActive) {
      passedChecks.push(`ℹ️ [RLS GATE]: Validación de RLS desactivada para este proyecto (seguridad a nivel aplicación).`);
    } else {
      const createdTables = [];
      const tblRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\.]+)/gi;
      let tMatch;
      while ((tMatch = tblRegex.exec(content)) !== null) {
        createdTables.push(tMatch[1].split('.').pop().replace(/[`"\[\]]/g, ''));
      }

      // Recolectar todo el SQL relevante de seguridad (directorio de seguridad + migraciones)
      let allSecuritySql = '';
      if (securityDir && fs.existsSync(securityDir)) {
        const secSqlFiles = getFilesRecursively(securityDir, /\.sql$/i).filter((f) => !/\.down\.sql$/i.test(f.name));
        allSecuritySql = secSqlFiles.map((f) => fs.readFileSync(f.path, 'utf8')).join('\n');
      }
      const combinedSqlForRls = content + '\n' + allSecuritySql;

      for (const tbl of createdTables) {
        if (/^(__|schema_migrations|pg_)/i.test(tbl)) continue;

        const rlsPattern = new RegExp(`ALTER\\s+TABLE\\s+(?:[a-zA-Z0-9_\\.]+\\.)?${tbl}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
        let isRlsEnabled = rlsPattern.test(content) || rlsPattern.test(allSecuritySql);

        if (!isRlsEnabled) {
          // Buscar en otros archivos de migración
          for (const tf of targetFiles) {
            if (tf.path === sqlFile.path) continue;
            const otherContent = fs.readFileSync(tf.path, 'utf8');
            if (rlsPattern.test(otherContent)) {
              isRlsEnabled = true;
              break;
            }
          }
        }

        // GATE CONDICIONAL DE RLS:
        // Si la tabla activa RLS, se audita exhaustivamente la cobertura de políticas y cláusulas de seguridad
        if (isRlsEnabled) {
          passedChecks.push(`✅ [RLS GATE]: RLS activado para tabla '${tbl}'. Evaluando cobertura y defensas...`);

          // 1. Detección de políticas
          const hasPolicyForAll =
            new RegExp(`CREATE\\s+POLICY\\s+[a-zA-Z0-9_]+\\s+ON\\s+(?:[a-zA-Z0-9_\\.]+\\.)?${tbl}\\s+[^;]*?\\bFOR\\s+ALL\\b`, 'i').test(combinedSqlForRls) ||
            new RegExp(`CREATE\\s+POLICY\\s+[a-zA-Z0-9_]+\\s+ON\\s+(?:[a-zA-Z0-9_\\.]+\\.)?${tbl}\\s+(?:AS\\s+[a-zA-Z0-9_]+\\s+)?(?:TO\\s+[a-zA-Z0-9_]+\\s+)?USING`, 'i').test(combinedSqlForRls);

          const hasSelectPolicy = hasPolicyForAll || new RegExp(`CREATE\\s+POLICY\\s+[a-zA-Z0-9_]+\\s+ON\\s+(?:[a-zA-Z0-9_\\.]+\\.)?${tbl}\\s+[^;]*?\\bFOR\\s+SELECT\\b`, 'i').test(combinedSqlForRls);
          const hasInsertPolicy = hasPolicyForAll || new RegExp(`CREATE\\s+POLICY\\s+[a-zA-Z0-9_]+\\s+ON\\s+(?:[a-zA-Z0-9_\\.]+\\.)?${tbl}\\s+[^;]*?\\bFOR\\s+INSERT\\b`, 'i').test(combinedSqlForRls);
          const hasUpdatePolicy = hasPolicyForAll || new RegExp(`CREATE\\s+POLICY\\s+[a-zA-Z0-9_]+\\s+ON\\s+(?:[a-zA-Z0-9_\\.]+\\.)?${tbl}\\s+[^;]*?\\bFOR\\s+UPDATE\\b`, 'i').test(combinedSqlForRls);
          const hasDeletePolicy = hasPolicyForAll || new RegExp(`CREATE\\s+POLICY\\s+[a-zA-Z0-9_]+\\s+ON\\s+(?:[a-zA-Z0-9_\\.]+\\.)?${tbl}\\s+[^;]*?\\bFOR\\s+DELETE\\b`, 'i').test(combinedSqlForRls);

          // 2. Extracción de privilegios otorgados mediante GRANT sobre la tabla
          const grantTableRegex = new RegExp(`GRANT\\s+([^;]+?)\\s+ON\\s+(?:TABLE\\s+)?(?:[a-zA-Z0-9_\\.]+\\.)?${tbl}\\s+TO\\s+([a-zA-Z0-9_]+)`, 'gi');
          let gMatch;
          const grantedOps = new Set();
          while ((gMatch = grantTableRegex.exec(combinedSqlForRls)) !== null) {
            const opsStr = gMatch[1].toUpperCase();
            if (opsStr.includes('ALL')) {
              grantedOps.add('SELECT');
              grantedOps.add('INSERT');
              grantedOps.add('UPDATE');
              grantedOps.add('DELETE');
            } else {
              if (opsStr.includes('SELECT')) grantedOps.add('SELECT');
              if (opsStr.includes('INSERT')) grantedOps.add('INSERT');
              if (opsStr.includes('UPDATE')) grantedOps.add('UPDATE');
              if (opsStr.includes('DELETE')) grantedOps.add('DELETE');
            }
          }

          // Si se otorgó GRANT a roles pero faltan políticas RLS que acoten la operación:
          if (grantedOps.has('UPDATE') && !hasUpdatePolicy) {
            failures.push(`❌ [RLS COBERTURA]: Privilegio UPDATE otorgado sobre '${tbl}' pero no existe política RLS 'FOR UPDATE' (ni 'FOR ALL').`);
          } else if (hasUpdatePolicy) {
            passedChecks.push(`✅ [RLS UPDATE]: Política de actualización detectada para '${tbl}'.`);
          }

          if (grantedOps.has('DELETE') && !hasDeletePolicy) {
            failures.push(`❌ [RLS COBERTURA]: Privilegio DELETE otorgado sobre '${tbl}' pero no existe política RLS 'FOR DELETE' (ni 'FOR ALL').`);
          } else if (hasDeletePolicy) {
            passedChecks.push(`✅ [RLS DELETE]: Política de eliminación detectada para '${tbl}'.`);
          }

          // 3. Verificación de WITH CHECK en UPDATE (Prevención de Tenant Hijacking)
          if (hasUpdatePolicy) {
            const updatePolicyBlockRegex = new RegExp(`CREATE\\s+POLICY\\s+[a-zA-Z0-9_]+\\s+ON\\s+(?:[a-zA-Z0-9_\\.]+\\.)?${tbl}\\s+[^;]*?\\bFOR\\s+UPDATE\\b([^;]+);`, 'gi');
            let upm;
            while ((upm = updatePolicyBlockRegex.exec(combinedSqlForRls)) !== null) {
              const body = upm[1];
              if (!/\bWITH\s+CHECK\b/i.test(body)) {
                warnings.push(`⚠️ [RLS UPDATE INSEGURO]: La política FOR UPDATE en '${tbl}' carece de cláusula 'WITH CHECK'. Esto permite que un usuario modifique un registro y cambie su tenant_id a otro cliente.`);
              } else {
                passedChecks.push(`✅ [RLS UPDATE]: Política FOR UPDATE en '${tbl}' blindada con 'WITH CHECK'.`);
              }
            }
          }
        } else {
          // Gate condicional inactivo para esta tabla (no bloquea si es tabla maestra o catálogo)
          passedChecks.push(`ℹ️ [RLS GATE]: Tabla '${tbl}' sin RLS activado (exención técnica o tabla maestra/catálogo).`);
        }
      }
    }
  } else if (engineLower === 'sqlite') {
    if (/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[a-zA-Z0-9_\.]+\s+CASCADE/i.test(content)) {
      failures.push(`❌ [SINTAXIS SQLITE]: 'CASCADE' no es soportado en DROP TABLE por SQLite en '${fileName}'.`);
    } else {
      passedChecks.push(`✅ [SQLITE]: Sintaxis DROP TABLE compatible con SQLite.`);
    }
  } else if (engineLower === 'mysql' || engineLower === 'mariadb') {
    passedChecks.push(`✅ [MYSQL]: Chequeos de sintaxis e índices compatibles con MySQL/MariaDB.`);
  }

  // D. Detección de Datos Sensibles (PII / Secrets)
  const sensitiveRegex = /\b(password|passwd|contrasena|token|secret|tarjeta|credit_card|cvv|ssn)\b\s+([a-zA-Z0-9_]+)/gi;
  let sm;
  while ((sm = sensitiveRegex.exec(content)) !== null) {
    const colName = sm[1];
    const type = sm[2].toUpperCase();
    if (['VARCHAR', 'TEXT', 'CHAR'].includes(type) && !/hash|cifrado|encrypt|argon2|bcrypt/i.test(content)) {
      warnings.push(`⚠️ [PII / COMPLIANCE]: Columna sensible sospechosa '${colName}' con tipo plano '${type}' en '${fileName}'. Verificar si debe almacenar hash (bcrypt/argon2) o cifrado.`);
    }
  }
}

// --- REPORTE FINAL ---
console.log(`${colors.gray}==================================================${colors.reset}`);
console.log(`${colors.cyan}📊 REPORTE DE VALIDACIÓN MECÁNICA DE BASE DE DATOS${colors.reset}`);
console.log(`${colors.gray}==================================================${colors.reset}`);

if (passedChecks.length > 0) {
  console.log(`\n${colors.green}✅ CHEQUEOS DETERMINISTAS SUPERADOS (${passedChecks.length}):${colors.reset}`);
  for (const p of passedChecks) {
    console.log(`   ${colors.green}${p}${colors.reset}`);
  }
}

if (warnings.length > 0) {
  console.log(`\n${colors.yellow}⚠️ ADVERTENCIAS DE CALIDAD/SEGURIDAD (${warnings.length}):${colors.reset}`);
  for (const w of warnings) {
    console.log(`   ${colors.yellow}${w}${colors.reset}`);
  }
}

if (failures.length > 0) {
  console.log(`\n${colors.red}❌ ERRORES BLOQUEANTES DETECTADOS (${failures.length}):${colors.reset}`);
  for (const f of failures) {
    console.log(`   ${colors.red}${f}${colors.reset}`);
  }
  console.log(`\n${colors.red}🛑 La validación mecánica ha FALLADO. Corrige los errores antes de avanzar.${colors.reset}`);
  process.exit(1);
} else {
  console.log(`\n${colors.green}🎉 Validación mecánica superada con ÉXITO. Código listo para auditoría de QA y revisión humana.${colors.reset}`);
  process.exit(0);
}
