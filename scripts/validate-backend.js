#!/usr/bin/env node
/**
 * Validador mecánico y determinista (Zero-LLM Gates 1 a 4) para el flujo SDD de la capa Backend.
 * Multiplataforma (Linux, macOS, Windows) en Node.js nativo sin dependencias externas.
 *
 * Uso:
 *   node validate-backend.js --gate <1|2|3|4|all> [opciones]
 *   node validate-backend.js --action <snapshot-db|snapshot-tests> [opciones]
 *
 * Opciones:
 *   --action <snapshot-db|snapshot-tests> Captura instantánea SHA-256 de BD o tests en .sdd-state.json
 *   --gate <1|2|3|4|all>        Gate determinista a ejecutar (por defecto: all)
 *   --repo-root <dir>           Raíz del repositorio destino (por defecto: process.cwd())
 *   --backend-dir <dir>         Directorio de código backend relativo o absoluto (ej: backend, src, app)
 *   --change-dir <dir>          Carpeta del cambio OpenSpec (ej: openspec/changes/0001-crear-ventas)
 *   --db-mode <with-db|stateless> Modo de acoplamiento con BD (por defecto: with-db)
 *   --db-dirs <csv>             Directorios de BD separados por coma (ej: database,supabase,prisma/migrations)
 *   --migration-exts <csv>      Extensiones válidas de migración/esquema en Gate 1 (ej: .sql,.prisma,.py,.ts)
 *   --rls-mode <dedicated|in-situ|none> Modo de seguridad RLS en BD (por defecto: none)
 *   --contract-style <style>    Estilo de contrato: code-first | openapi-first | worker-job | graphql | grpc
 *   --openapi-path <file>       Ruta a openapi.yaml / openapi.json (requerido si contract-style = openapi-first)
 *   --tests-dir <dir>           Directorio de pruebas (ej: tests, backend/tests)
 *   --test-cmd <cmd>            Comando obligatorio de runner de tests para ejecutar en Gate 4
 *   --require-tests-freeze      Exige que exista instantánea previa de tests en .sdd-state.json durante Gate 4
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

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
let action = '';
let gate = 'all';
let repoRoot = process.cwd();
let backendDir = '';
let changeDir = '';
let dbMode = 'with-db';
let dbDirsCsv = '';
let migrationExtsCsv = '';
let rlsMode = 'none';
let contractStyle = 'code-first';
let openapiPath = '';
let testsDir = '';
let testCmd = '';
let requireTestsFreeze = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--action') action = String(args[++i] || '').toLowerCase();
  else if (arg === '--gate' || arg === '-g') gate = String(args[++i] || 'all').toLowerCase();
  else if (arg === '--repo-root') repoRoot = args[++i] || process.cwd();
  else if (arg === '--backend-dir') backendDir = args[++i] || '';
  else if (arg === '--change-dir') changeDir = args[++i] || '';
  else if (arg === '--db-mode') dbMode = (args[++i] || 'with-db').toLowerCase();
  else if (arg === '--db-dirs') dbDirsCsv = args[++i] || '';
  else if (arg === '--migration-exts') migrationExtsCsv = args[++i] || '';
  else if (arg === '--rls-mode') rlsMode = (args[++i] || 'none').toLowerCase();
  else if (arg === '--contract-style') contractStyle = (args[++i] || 'code-first').toLowerCase();
  else if (arg === '--openapi-path') openapiPath = args[++i] || '';
  else if (arg === '--tests-dir') testsDir = args[++i] || '';
  else if (arg === '--test-cmd') testCmd = args[++i] || '';
  else if (arg === '--require-tests-freeze') requireTestsFreeze = true;
}

repoRoot = path.resolve(repoRoot);

function resolveInRepo(relOrAbs) {
  if (!relOrAbs) return '';
  return path.isAbsolute(relOrAbs) ? relOrAbs : path.resolve(repoRoot, relOrAbs);
}

function listFilesRecursive(dirPath, extFilter = null) {
  const results = [];
  if (!dirPath || !fs.existsSync(dirPath)) return results;
  const stat = fs.statSync(dirPath);
  if (stat.isFile()) return [dirPath];

  const ignoredDirs = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build', '.pytest_cache', '.mypy_cache']);
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full, extFilter));
    } else if (!extFilter || extFilter.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

const errors = [];
const warnings = [];
const checks = [];

function pass(msg) {
  checks.push(`${colors.green}✅ ${msg}${colors.reset}`);
}
function warn(msg) {
  warnings.push(msg);
  checks.push(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
}
function fail(msg) {
  errors.push(msg);
  checks.push(`${colors.red}❌ ${msg}${colors.reset}`);
}

// --- Auto-detección de directorios de BD si no se pasaron explícitamente ---
let explicitDbDirsChecked = false;
function getDbDirectories(strictExplicit = false) {
  if (dbDirsCsv) {
    const requested = dbDirsCsv
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(d => ({ raw: d, abs: resolveInRepo(d) }));

    if (strictExplicit && !explicitDbDirsChecked) {
      explicitDbDirsChecked = true;
      for (const item of requested) {
        if (!fs.existsSync(item.abs)) {
          fail(`[Gate] El directorio especificado en '--db-dirs' no existe en el repositorio: '${item.raw}'.`);
        }
      }
    }
    return requested.filter(item => fs.existsSync(item.abs)).map(item => item.abs);
  }
  const candidates = [
    'database',
    'supabase/migrations',
    'supabase/security',
    'prisma/migrations',
    'db/migrations',
    'migrations'
  ];
  return candidates.map(c => resolveInRepo(c)).filter(d => fs.existsSync(d));
}

// --- Helpers de Instantáneas SHA-256 y .sdd-state.json ---
function getStateFilePath() {
  if (!changeDir) return '';
  return path.join(resolveInRepo(changeDir), '.sdd-state.json');
}

function loadSddState() {
  const statePath = getStateFilePath();
  if (!statePath || !fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (err) {
    fail(`[State] El archivo '${path.relative(repoRoot, statePath)}' no es JSON válido: ${err.message}`);
    return null;
  }
}

function saveSddState(updater) {
  const statePath = getStateFilePath();
  if (!statePath) {
    fail(`[State] Se requiere '--change-dir' para guardar instantáneas en '.sdd-state.json'.`);
    return null;
  }
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let state = { schema_version: 1, layer: 'backend', max_repeat: 2, attempt: 0, errors: [] };
  if (fs.existsSync(statePath)) {
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (err) {
      fail(`[State] El archivo '${path.relative(repoRoot, statePath)}' está corrupto: ${err.message}`);
      return null;
    }
  }
  updater(state);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  return statePath;
}

function computeFilesSnapshot(filePaths) {
  const files = {};
  const uniqueSorted = [...new Set(filePaths)].sort();
  for (const fp of uniqueSorted) {
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) continue;
    const rel = path.relative(repoRoot, fp).replace(/\\/g, '/');
    const hash = crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
    files[rel] = hash;
  }
  const digest = crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');
  return { captured_at: new Date().toISOString(), file_count: Object.keys(files).length, digest, files };
}

function diffSnapshots(expectedFiles, currentFiles) {
  const added = [];
  const removed = [];
  const modified = [];
  for (const rel of Object.keys(currentFiles)) {
    if (!(rel in expectedFiles)) added.push(rel);
    else if (expectedFiles[rel] !== currentFiles[rel]) modified.push(rel);
  }
  for (const rel of Object.keys(expectedFiles)) {
    if (!(rel in currentFiles)) removed.push(rel);
  }
  return { added, removed, modified, hasChanges: added.length > 0 || removed.length > 0 || modified.length > 0 };
}

function getCandidateTestDirs() {
  return testsDir
    ? [resolveInRepo(testsDir)].filter(d => fs.existsSync(d))
    : ['tests', 'backend/tests', 'src/__tests__', '__tests__'].map(d => resolveInRepo(d)).filter(d => fs.existsSync(d));
}

function getMigrationExtensions() {
  if (migrationExtsCsv) {
    return migrationExtsCsv
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
      .map(ext => (ext.startsWith('.') ? ext : `.${ext}`));
  }
  return ['.sql', '.prisma', '.py', '.ts', '.js', '.go', '.rb'];
}

// ============================================================================
// GATE 1: Pre-condición de Base de Datos e Introspección
// ============================================================================
function runGate1() {
  console.log(`\n${colors.bold}${colors.cyan}🔍 [Gate 1] Verificando Pre-condiciones de Base de Datos e Introspección...${colors.reset}`);

  if (dbMode === 'stateless' || dbMode === 'none') {
    pass(`Modo sin base de datos ('${dbMode}'): se omite exigencia de artefactos de BD previos.`);
    return;
  }

  const detectedDbDirs = getDbDirectories(true);
  const prismaSchema = resolveInRepo('prisma/schema.prisma');
  const hasPrisma = fs.existsSync(prismaSchema);

  if (detectedDbDirs.length === 0 && !hasPrisma) {
    fail(
      `[Gate 1] db_mode='with-db' pero no se encontraron directorios de base de datos (database/, supabase/migrations/, prisma/, migrations/). Ejecuta primero '_skills/db-sdd/SKILL.md' o usa '--db-mode stateless' si el ticket no toca BD.`
    );
    return;
  }

  const allowedExts = getMigrationExtensions();
  const migrationFiles = [];
  for (const dir of detectedDbDirs) {
    migrationFiles.push(
      ...listFilesRecursive(dir, allowedExts).filter(f => path.basename(f).toLowerCase() !== '__init__.py')
    );
  }
  if (hasPrisma) migrationFiles.push(prismaSchema);

  if (migrationFiles.length === 0) {
    fail(
      `[Gate 1] Los directorios de BD detectados no contienen archivos con extensiones válidas (${allowedExts.join(', ')}). Debe existir al menos una migración o esquema validado antes de iniciar Backend.`
    );
  } else {
    pass(
      `[Gate 1] Artefactos de BD verificados (${migrationFiles.length} archivo(s) en ${detectedDbDirs.map(d => path.relative(repoRoot, d)).join(', ') || 'prisma'}).`
    );
  }
}

// ============================================================================
// GATE 2: Validación de Especificación OpenSpec y Contrato API
// ============================================================================
function runGate2() {
  console.log(`\n${colors.bold}${colors.cyan}🔍 [Gate 2] Validando Paquete OpenSpec y Contrato Backend (${contractStyle})...${colors.reset}`);

  if (!changeDir) {
    warn(`[Gate 2] No se especificó '--change-dir'. Verificando solo contrato si fue provisto.`);
  } else {
    const absChangeDir = resolveInRepo(changeDir);
    const requiredArtifacts = ['proposal.md', 'design.md', 'tasks.md'];
    for (const reqFile of requiredArtifacts) {
      const fullPath = path.join(absChangeDir, reqFile);
      if (!fs.existsSync(fullPath)) {
        fail(`[Gate 2] Falta artefacto OpenSpec obligatorio: ${path.relative(repoRoot, fullPath)}`);
      } else {
        const content = fs.readFileSync(fullPath, 'utf8').trim();
        if (content.length < 50) {
          fail(`[Gate 2] El artefacto '${reqFile}' está vacío o incompleto (< 50 caracteres).`);
        } else {
          pass(`[Gate 2] Artefacto OpenSpec presente y válido: ${reqFile}`);
        }
      }
    }

    // Verificar spec.md con estructura formal de escenarios y GIVEN / WHEN / THEN
    const specsDir = path.join(absChangeDir, 'specs');
    const specFiles = listFilesRecursive(specsDir, ['.md']);
    if (specFiles.length === 0) {
      fail(`[Gate 2] No se encontró ningún archivo 'specs/<capability>/spec.md' dentro de ${path.relative(repoRoot, absChangeDir)}.`);
    } else {
      for (const sf of specFiles) {
        const content = fs.readFileSync(sf, 'utf8');
        const hasScenario = /^\s*#{2,4}\s*Scenario\s*:/im.test(content);
        const hasGiven = /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?GIVEN(?:\*\*)?\b/.test(content) || /(?:^|\n)\s*[-*]\s*(?:\*\*)?Given(?:\*\*)?\b/.test(content);
        const hasWhen = /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?WHEN(?:\*\*)?\b/.test(content) || /(?:^|\n)\s*[-*]\s*(?:\*\*)?When(?:\*\*)?\b/.test(content);
        const hasThen = /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?THEN(?:\*\*)?\b/.test(content) || /(?:^|\n)\s*[-*]\s*(?:\*\*)?Then(?:\*\*)?\b/.test(content);
        if (!hasScenario || !hasGiven || !hasWhen || !hasThen) {
          fail(`[Gate 2] La especificación '${path.relative(repoRoot, sf)}' debe incluir bloques '#### Scenario:' con pasos formales GIVEN / WHEN / THEN.`);
        } else {
          pass(`[Gate 2] Especificación '${path.relative(repoRoot, sf)}' contiene escenarios formales GIVEN/WHEN/THEN verificables.`);
        }
      }
    }
  }

  // Validación condicional según contractStyle
  if (contractStyle === 'openapi-first') {
    const candidateOpenapi = openapiPath
      ? resolveInRepo(openapiPath)
      : changeDir
      ? path.join(resolveInRepo(changeDir), 'openapi.yaml')
      : resolveInRepo('openapi.yaml');

    if (!fs.existsSync(candidateOpenapi)) {
      fail(`[Gate 2] En modo 'openapi-first' debe existir el archivo de contrato OpenAPI ('${path.relative(repoRoot, candidateOpenapi)}').`);
      return;
    }

    const raw = fs.readFileSync(candidateOpenapi, 'utf8');
    const relOpenapi = path.relative(repoRoot, candidateOpenapi);

    if (candidateOpenapi.toLowerCase().endsWith('.json')) {
      let doc;
      try {
        doc = JSON.parse(raw);
      } catch (err) {
        fail(`[Gate 2] El contrato JSON '${relOpenapi}' no es un JSON válido: ${err.message}`);
        return;
      }
      if (!String(doc.openapi || '').startsWith('3.')) {
        fail(`[Gate 2] El contrato '${relOpenapi}' no declara una versión válida 'openapi: 3.x.x'.`);
      } else if (!doc.paths || typeof doc.paths !== 'object') {
        fail(`[Gate 2] El contrato '${relOpenapi}' no contiene la sección obligatoria 'paths'.`);
      } else {
        const refs = [];
        const collectRefs = node => {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) {
            node.forEach(collectRefs);
            return;
          }
          if (typeof node.$ref === 'string') refs.push(node.$ref);
          Object.values(node).forEach(collectRefs);
        };
        collectRefs(doc);
        let brokenRefs = 0;
        let checkedRefs = 0;
        for (const ref of refs) {
          const m = /^#\/components\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/.exec(ref);
          if (!m) continue;
          checkedRefs++;
          const [, section, targetName] = m;
          if (!doc.components || !doc.components[section] || !(targetName in doc.components[section])) {
            fail(`[Gate 2] Referencia '$ref' rota en OpenAPI: '${ref}' no está definida.`);
            brokenRefs++;
          }
        }
        if (brokenRefs === 0) {
          pass(`[Gate 2] Contrato OpenAPI 3.x JSON ('${relOpenapi}') validado estructuralmente (${checkedRefs} referencias internas verificadas).`);
        }
      }
    } else {
      if (!/^openapi\s*:\s*['"]?3\./m.test(raw)) {
        fail(`[Gate 2] El contrato '${relOpenapi}' no declara una versión válida 'openapi: 3.x.x'.`);
      } else if (!/^\s*paths\s*:/m.test(raw)) {
        fail(`[Gate 2] El contrato '${relOpenapi}' no contiene la sección obligatoria 'paths:'.`);
      } else {
        const refMatches = [...raw.matchAll(/['"]?\$ref['"]?\s*:\s*['"]?#\/components\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)['"]?/g)];
        let brokenRefs = 0;
        for (const m of refMatches) {
          const targetName = m[2];
          const escaped = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const defRegex = new RegExp(`^\\s*['"]?${escaped}['"]?\\s*:`, 'm');
          if (!defRegex.test(raw)) {
            fail(`[Gate 2] Referencia '$ref' rota en OpenAPI: '#/components/${m[1]}/${targetName}' no está definida.`);
            brokenRefs++;
          }
        }
        if (brokenRefs === 0) {
          pass(`[Gate 2] Contrato OpenAPI 3.x ('${relOpenapi}') validado estructuralmente (${refMatches.length} referencias internas verificadas).`);
        }
      }
    }
  } else {
    pass(`[Gate 2] Estilo de contrato '${contractStyle}': no se exige archivo openapi.yaml manual previo (el contrato se rige por spec.md / design.md y esquemas tipados).`);
  }
}

// ============================================================================
// GATE 3: Inmutabilidad de BD (No-DB-Diff) y Escaneo Estático de Seguridad
// ============================================================================
function collectDbFiles(dbDirs) {
  const files = [];
  for (const dir of dbDirs) {
    files.push(...listFilesRecursive(dir));
  }
  const prismaSchema = resolveInRepo('prisma/schema.prisma');
  if (fs.existsSync(prismaSchema)) files.push(prismaSchema);
  return files;
}

function runGate3() {
  console.log(`\n${colors.bold}${colors.cyan}🔍 [Gate 3] Verificando Inmutabilidad de BD (No-DB-Diff) y Guardrails de Código Backend...${colors.reset}`);

  // 1. Verificar inmutabilidad de BD: contra instantánea inicial en .sdd-state.json si existe, o git diff como respaldo
  if (dbMode !== 'stateless' && dbMode !== 'none') {
    const dbDirs = getDbDirectories(true);
    const state = changeDir ? loadSddState() : null;
    const dbSnapshot = state && state.backend_snapshots && state.backend_snapshots.db;

    if (dbSnapshot && dbSnapshot.files) {
      const currentSnapshot = computeFilesSnapshot(collectDbFiles(dbDirs));
      const diff = diffSnapshots(dbSnapshot.files, currentSnapshot.files);
      if (diff.hasChanges) {
        const details = [
          diff.added.length ? `agregados: ${diff.added.join(', ')}` : '',
          diff.modified.length ? `modificados: ${diff.modified.join(', ')}` : '',
          diff.removed.length ? `eliminados: ${diff.removed.join(', ')}` : ''
        ]
          .filter(Boolean)
          .join(' | ');
        fail(
          `[Gate 3] VIOLACIÓN DE INMUTABILIDAD DE BD: Se alteraron archivos de base de datos respecto a la instantánea inicial del paso (${details}). La capa backend tiene prohibido alterar migraciones o políticas RLS.`
        );
      } else {
        pass(`[Gate 3] Inmutabilidad de BD respetada contra instantánea inicial (${currentSnapshot.file_count} archivo(s) sin cambios).`);
      }
    } else {
      for (const dir of dbDirs) {
        const relDir = path.relative(repoRoot, dir);
        try {
          execSync(`git -C "${repoRoot}" diff --exit-code -- "${relDir}"`, { stdio: 'pipe' });
          execSync(`git -C "${repoRoot}" diff --cached --exit-code -- "${relDir}"`, { stdio: 'pipe' });
          const untracked = execSync(`git -C "${repoRoot}" ls-files --others --exclude-standard -- "${relDir}"`, { encoding: 'utf8' }).trim();
          if (untracked) {
            fail(`[Gate 3] VIOLACIÓN DE INMUTABILIDAD DE BD: Se crearon archivos no autorizados en '${relDir}':\n   ${untracked.split('\n').join(', ')}`);
          } else {
            pass(`[Gate 3] Inmutabilidad de BD respetada en '${relDir}' (0 modificaciones).`);
          }
        } catch (err) {
          fail(`[Gate 3] VIOLACIÓN DE INMUTABILIDAD DE BD: 'backend-developer-agent' modificó archivos dentro de '${relDir}'. La capa backend tiene prohibido alterar migraciones o políticas RLS.`);
        }
      }
    }
  }

  // 2. Escanear directorio de código backend por secretos hardcodeados o bypass de RLS
  const absBackendDir = backendDir ? resolveInRepo(backendDir) : repoRoot;
  if (absBackendDir === repoRoot) {
    warn(`[Gate 3] '--backend-dir' no fue acotado a un subdirectorio específico (se excluyen carpetas de tooling/tests del escaneo raíz).`);
  }
  const excludedRootDirs = ['scripts', 'openspec', '.claude', '_skills', 'agents', 'docs', 'frontend'];
  const isTestOrExcluded = filePath => {
    const rel = path.relative(repoRoot, filePath);
    const parts = rel.split(path.sep);
    if (parts.some(p => ['node_modules', 'tests', '__tests__', 'test'].includes(p))) return true;
    if (absBackendDir === repoRoot && excludedRootDirs.includes(parts[0])) return true;
    const base = path.basename(filePath).toLowerCase();
    return /\.(test|spec)\.[jt]sx?$/.test(base) || /^test_.*\.py$/.test(base) || /_test\.go$/.test(base) || base === 'conftest.py';
  };
  const codeFiles = listFilesRecursive(absBackendDir, ['.py', '.ts', '.js', '.go', '.rs']).filter(f => !isTestOrExcluded(f));

  const secretPatterns = [
    { name: 'Private Key bloque PEM', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
    { name: 'Token JWT hardcodeado (eyJ...)', regex: /['"]eyJhbGciOi[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}['"]/ },
    { name: 'Password/Secret literal en código', regex: /(password|secret_key|api_key)\s*=\s*['"][^'"{$\s]{12,}['"]/i }
  ];

  let securityIssues = 0;
  for (const file of codeFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const relFile = path.relative(repoRoot, file);

    for (const pat of secretPatterns) {
      if (pat.regex.test(content)) {
        fail(`[Gate 3] Posible secreto hardcodeado (${pat.name}) detectado en '${relFile}'. Usa variables de entorno.`);
        securityIssues++;
      }
    }

    if (rlsMode !== 'none' && /SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(content)) {
      if (!/admin|system|cron|webhook-internal/i.test(relFile)) {
        warn(`[Gate 3] Uso de 'service_role' detectado en '${relFile}' con rls_mode='${rlsMode}'. Asegúrate de que 'backend-qa-agent' verifique que no bypassea RLS en flujos de usuario.`);
      }
    }
  }

  if (securityIssues === 0) {
    pass(`[Gate 3] Escaneo estático de secretos y guardrails de seguridad superado (${codeFiles.length} archivo(s) inspeccionados).`);
  }
}

// ============================================================================
// GATE 4: Verificación de Suite de Tests y Trazabilidad de Escenarios
// ============================================================================
function runGate4() {
  console.log(`\n${colors.bold}${colors.cyan}🔍 [Gate 4] Verificando Suite de Pruebas Backend-TDD y Ejecución...${colors.reset}`);

  const candidateTestDirs = getCandidateTestDirs();

  const rawTestFiles = [];
  for (const td of candidateTestDirs) {
    rawTestFiles.push(...listFilesRecursive(td, ['.py', '.ts', '.js', '.go']));
  }

  const isHelperOrConfig = filePath => {
    const base = path.basename(filePath).toLowerCase();
    if (['__init__.py', 'conftest.py'].includes(base)) return true;
    if (/^(setup|fixtures?|helpers?|utils?|vitest\.config|jest\.config)\.[a-z0-9]+$/.test(base)) return true;
    return false;
  };
  const testFiles = rawTestFiles.filter(f => !isHelperOrConfig(f));

  if (testFiles.length === 0) {
    fail(`[Gate 4] No se encontraron archivos de prueba reales en ${testsDir || 'tests/'} (excluyendo helpers/conftest). 'backend-qa-agent' debe generar la suite Backend-TDD antes de aprobar.`);
    return;
  }

  // Verificar convención de nombres de tests por dominio (prohibido usar IDs de tickets o <change-name>)
  const changeSlug = changeDir ? path.basename(changeDir).toLowerCase() : '';
  let invalidTestNames = 0;
  let totalTestCases = 0;
  for (const tf of testFiles) {
    const base = path.basename(tf).toLowerCase();
    const hasTicketPattern = /\b(us-?\d+-?t\d+|e\d+-us\d+|\d{4}-[a-z0-9-]+)\b/i.test(base);
    const hasChangeName = changeSlug && base.includes(changeSlug);
    if (hasTicketPattern || hasChangeName) {
      fail(
        `[Gate 4] Violación de convención de tests por dominio en '${path.relative(repoRoot, tf)}': está prohibido nombrar archivos de test con IDs de tickets o '<change-name>'. Usa nombres de dominio/módulo/entidad.`
      );
      invalidTestNames++;
    }
    const tfContent = fs.readFileSync(tf, 'utf8');
    const caseMatches = tfContent.match(/^\s*(?:async\s+)?def\s+test_|^\s*(?:it|test)\s*\(|^\s*func\s+Test/gm) || [];
    totalTestCases += caseMatches.length;
  }

  if (totalTestCases === 0) {
    fail(`[Gate 4] Los archivos en ${testsDir || 'tests/'} no contienen casos de prueba reales ('def test_', 'it(', 'test(', 'func Test').`);
  } else if (invalidTestNames === 0) {
    pass(`[Gate 4] Suite de pruebas por dominio detectada y validada (${testFiles.length} archivo(s), ${totalTestCases} caso(s) de prueba).`);
  }

  // Trazabilidad mínima contra escenarios declarados en specs/ del changeDir
  if (changeDir) {
    const specsDir = path.join(resolveInRepo(changeDir), 'specs');
    const specFiles = listFilesRecursive(specsDir, ['.md']);
    let specScenarioCount = 0;
    for (const sf of specFiles) {
      const sfContent = fs.readFileSync(sf, 'utf8');
      const matches = sfContent.match(/^\s*#{2,4}\s*Scenario\s*:/gim) || [];
      specScenarioCount += matches.length;
    }
    if (specScenarioCount > 0 && totalTestCases < specScenarioCount) {
      fail(`[Gate 4] Cobertura insuficiente: 'specs/' declara ${specScenarioCount} escenario(s) pero la suite solo contiene ${totalTestCases} caso(s) de prueba.`);
    } else if (specScenarioCount > 0) {
      pass(`[Gate 4] Trazabilidad de escenarios verificada (${totalTestCases} test(s) >= ${specScenarioCount} escenario(s) en specs/).`);
    }
  }

  // Verificación de congelamiento de tests (huella SHA-256 tras ROJO)
  if (changeDir) {
    const state = loadSddState();
    const testsSnapshot = state && state.backend_snapshots && state.backend_snapshots.tests;
    if (testsSnapshot && testsSnapshot.files) {
      const currentTestsFiles = [];
      for (const td of candidateTestDirs) {
        currentTestsFiles.push(...listFilesRecursive(td));
      }
      const currentSnapshot = computeFilesSnapshot(currentTestsFiles);
      const diff = diffSnapshots(testsSnapshot.files, currentSnapshot.files);
      if (diff.hasChanges) {
        const details = [
          diff.added.length ? `agregados: ${diff.added.join(', ')}` : '',
          diff.modified.length ? `modificados: ${diff.modified.join(', ')}` : '',
          diff.removed.length ? `eliminados: ${diff.removed.join(', ')}` : ''
        ]
          .filter(Boolean)
          .join(' | ');
        fail(
          `[Gate 4] VIOLACIÓN DE CONGELAMIENTO DE TESTS: Los archivos de prueba cambiaron después del ROJO (${details}). El implementador tiene prohibido modificar tests.`
        );
      } else {
        pass(`[Gate 4] Huella de tests congelados verificada (${currentSnapshot.file_count} archivo(s) intactos desde ROJO).`);
      }
    } else if (requireTestsFreeze) {
      fail(`[Gate 4] Falta la huella de tests congelados en '${path.join(changeDir, '.sdd-state.json')}'. Ejecuta '--action snapshot-tests' tras el ROJO.`);
    }
  }

  if (!testCmd) {
    fail(`[Gate 4] Se requiere '--test-cmd' para ejecutar el runner de pruebas real. Gate 4 no puede aprobar solo revisando archivos.`);
  } else {
    try {
      console.log(`${colors.gray}   Ejecutando comando de pruebas: ${testCmd}${colors.reset}`);
      execSync(testCmd, { cwd: repoRoot, stdio: 'inherit' });
      pass(`[Gate 4] Ejecución del runner de pruebas ('${testCmd}') finalizó con código 0.`);
    } catch (err) {
      fail(`[Gate 4] El runner de pruebas ('${testCmd}') falló con código de salida distinto de 0.`);
    }
  }
}

// ============================================================================
// ACCIONES DE INSTANTÁNEA (snapshot-db / snapshot-tests)
// ============================================================================
function runActionSnapshotDb() {
  console.log(`\n${colors.bold}${colors.cyan}📸 [Snapshot DB] Capturando instantánea inicial de base de datos...${colors.reset}`);
  if (!changeDir) {
    fail(`[Snapshot DB] Se requiere '--change-dir' para persistir la instantánea.`);
    return;
  }
  let snapshot;
  if (dbMode === 'stateless' || dbMode === 'none') {
    snapshot = { db_mode: dbMode, captured_at: new Date().toISOString(), file_count: 0, digest: '', files: {} };
  } else {
    const dbDirs = getDbDirectories(true);
    if (errors.length > 0) return;
    snapshot = { db_mode: dbMode, ...computeFilesSnapshot(collectDbFiles(dbDirs)) };
  }
  const savedPath = saveSddState(state => {
    state.backend_snapshots = state.backend_snapshots || {};
    state.backend_snapshots.db = snapshot;
  });
  if (savedPath) {
    pass(`[Snapshot DB] Instantánea de BD guardada en '${path.relative(repoRoot, savedPath)}' (${snapshot.file_count} archivo(s)).`);
  }
}

function runActionSnapshotTests() {
  console.log(`\n${colors.bold}${colors.cyan}📸 [Snapshot Tests] Congelando huella SHA-256 de la suite de pruebas...${colors.reset}`);
  if (!changeDir) {
    fail(`[Snapshot Tests] Se requiere '--change-dir' para persistir la huella.`);
    return;
  }
  const candidateTestDirs = getCandidateTestDirs();
  const allFiles = [];
  for (const td of candidateTestDirs) {
    allFiles.push(...listFilesRecursive(td));
  }
  if (allFiles.length === 0) {
    fail(`[Snapshot Tests] No se encontraron archivos de prueba en ${testsDir || 'tests/'} para congelar.`);
    return;
  }
  const snapshot = computeFilesSnapshot(allFiles);
  const savedPath = saveSddState(state => {
    state.backend_snapshots = state.backend_snapshots || {};
    state.backend_snapshots.tests = snapshot;
  });
  if (savedPath) {
    pass(`[Snapshot Tests] Huella de tests congelada en '${path.relative(repoRoot, savedPath)}' (${snapshot.file_count} archivo(s), digest ${snapshot.digest.slice(0, 12)}).`);
  }
}

function runActionVerifyRed() {
  console.log(`\n${colors.bold}${colors.cyan}🔴 [Verify Red] Validando que la suite TDD falle en ROJO por motivo válido...${colors.reset}`);
  if (!testCmd) {
    fail(`[Verify Red] Se requiere '--test-cmd' para verificar el estado ROJO real.`);
    return;
  }
  try {
    execSync(testCmd, { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' });
    fail(`[Verify Red] VIOLACIÓN TDD: La suite de pruebas nació en VERDE (exit 0) antes de implementar. Deteniendo flujo.`);
  } catch (err) {
    const output = `${err.stdout || ''}\n${err.stderr || ''}`;
    const brokenPatterns = [
      { label: 'SyntaxError / IndentationError', regex: /\b(?:SyntaxError|IndentationError)\b/ },
      { label: 'Import / módulo no encontrado', regex: /\b(?:ModuleNotFoundError|ImportError|ERR_MODULE_NOT_FOUND)\b|Cannot find module/ },
      { label: 'Sin tests ejecutados (0 tests)', regex: /collected 0 items|no tests found|\b0 tests?\b/i }
    ];
    for (const bp of brokenPatterns) {
      if (bp.regex.test(output)) {
        fail(`[Verify Red] ROJO INVÁLIDO (${bp.label}): Corrige los archivos de prueba o imports antes de congelar los tests.`);
        return;
      }
    }
    pass(`[Verify Red] ROJO válido verificado: la suite ejecutó y falló esperadamente (exit ${err.status ?? 1}).`);
  }
}

// --- Ejecución según Acción o Gate solicitado ---
if (action === 'snapshot-db') {
  runActionSnapshotDb();
} else if (action === 'snapshot-tests') {
  runActionSnapshotTests();
} else if (action === 'verify-red') {
  runActionVerifyRed();
} else if (action) {
  fail(`Acción desconocida '${action}'. Valores permitidos: snapshot-db, snapshot-tests, verify-red.`);
} else {
  if (gate === '1' || gate === 'all') runGate1();
  if (gate === '2' || gate === 'all') runGate2();
  if (gate === '3' || gate === 'all') runGate3();
  if (gate === '4' || gate === 'all') runGate4();
}

// --- Resumen Final ---
const modeLabel = action ? `Action: ${action.toUpperCase()}` : `Gate: ${gate.toUpperCase()}`;
console.log(`\n${colors.bold}📋 Resumen de Validación Mecánica Backend (${modeLabel}):${colors.reset}`);
for (const c of checks) console.log(`  ${c}`);

if (errors.length > 0) {
  console.error(`\n${colors.red}${colors.bold}❌ Validación Mecánica FALLIDA con ${errors.length} error(es) bloqueante(s).${colors.reset}`);
  process.exit(1);
} else {
  console.log(`\n${colors.green}${colors.bold}✅ Validación Mecánica APROBADA (${warnings.length} advertencia(s)).${colors.reset}`);
  process.exit(0);
}
