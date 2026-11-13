#!/usr/bin/env node
/**
 * Validador mecánico y determinista (Zero-LLM Gates 1 a 4) para el flujo SDD de la capa Frontend.
 * Multiplataforma (Linux, macOS, Windows) en Node.js nativo sin dependencias externas.
 *
 * Uso:
 *   node validate-frontend.js --gate <1|2|3|4|all> [opciones]
 *
 * Opciones:
 *   --gate <1|2|3|4|all|none>         Gate determinista a ejecutar (por defecto: all)
 *   --snapshot-tests                  Registra snapshot autorizado de tests_hash en diff_history (para frontend-qa-agent)
 *   --repo-root <dir>                 Raíz del repositorio destino (por defecto: process.cwd())
 *   --frontend-dir <dir>              Directorio de código frontend (ej: frontend, src, app)
 *   --change-dir <dir>                Carpeta del cambio OpenSpec (ej: openspec/changes/0001-pos-cart-frontend)
 *   --contract-mode <mode>            contract-first | frontend-driven | none (por defecto: contract-first)
 *   --openapi-path <file>             Ruta a openapi.yaml / openapi.json
 *   --tests-dir <dir>                 Directorio de pruebas frontend
 *   --protected-dirs <csv>            Rutas inmutables separadas por coma (ej: database,backend)
 *   --bundle-dir <dir>                Directorio de build de producción para medir tamaño (ej: dist/assets)
 *   --max-bundle-kb <num>             Presupuesto máximo de bundle JS inicial en KB (por defecto: 250)
 *   --lint-cmd <cmd>                  Comando opcional de linter
 *   --typecheck-cmd <cmd>             Comando opcional de typecheck
 *   --build-dev-cmd <cmd>             Comando opcional de build en desarrollo
 *   --build-prod-cmd <cmd>            Comando opcional de build en producción
 *   --test-cmd <cmd>                  Comando opcional de runner de tests (Gate 3 y Gate 4)
 *   --node <name>                     Nombre del nodo/agente actual (registra fallo automático si el Gate falla)
 *   --record-failure <node>           Fuerza registro de fallo consecutivo en .frontend-state.json (límite > 3)
 *   --reset-revision <node>           Reinicia revision_count del nodo y registra snapshot en diff_history
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
  red: '\x1b[31m'
};

const args = process.argv.slice(2);
const opts = {
  gate: 'all',
  repoRoot: process.cwd(),
  frontendDir: '',
  changeDir: '',
  contractMode: 'contract-first',
  openapiPath: '',
  testsDir: '',
  protectedDirs: '',
  bundleDir: '',
  maxBundleKb: 250,
  lintCmd: '',
  typecheckCmd: '',
  buildDevCmd: '',
  buildProdCmd: '',
  testCmd: '',
  node: '',
  recordFailure: '',
  resetRevision: '',
  snapshotTests: false
};

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--gate' || a === '-g') opts.gate = String(args[++i] || 'all').toLowerCase();
  else if (a === '--repo-root') opts.repoRoot = args[++i] || process.cwd();
  else if (a === '--frontend-dir') opts.frontendDir = args[++i] || '';
  else if (a === '--change-dir') opts.changeDir = args[++i] || '';
  else if (a === '--contract-mode') opts.contractMode = (args[++i] || 'contract-first').toLowerCase();
  else if (a === '--openapi-path') opts.openapiPath = args[++i] || '';
  else if (a === '--tests-dir') opts.testsDir = args[++i] || '';
  else if (a === '--protected-dirs') opts.protectedDirs = args[++i] || '';
  else if (a === '--bundle-dir') opts.bundleDir = args[++i] || '';
  else if (a === '--max-bundle-kb') opts.maxBundleKb = Number(args[++i] || 250) || 250;
  else if (a === '--lint-cmd') opts.lintCmd = args[++i] || '';
  else if (a === '--typecheck-cmd') opts.typecheckCmd = args[++i] || '';
  else if (a === '--build-dev-cmd') opts.buildDevCmd = args[++i] || '';
  else if (a === '--build-prod-cmd') opts.buildProdCmd = args[++i] || '';
  else if (a === '--test-cmd') opts.testCmd = args[++i] || '';
  else if (a === '--node') opts.node = args[++i] || '';
  else if (a === '--record-failure') opts.recordFailure = args[++i] || '';
  else if (a === '--reset-revision') opts.resetRevision = args[++i] || '';
  else if (a === '--snapshot-tests') opts.snapshotTests = true;
}

opts.repoRoot = path.resolve(opts.repoRoot);

const errors = [];
const warnings = [];
const checks = [];

const pass = (m) => checks.push(`${colors.green}✅ ${m}${colors.reset}`);
const warn = (m) => { warnings.push(m); checks.push(`${colors.yellow}⚠️  ${m}${colors.reset}`); };
const fail = (m) => { errors.push(m); checks.push(`${colors.red}❌ ${m}${colors.reset}`); };

function resolveInRepo(p) {
  if (!p) return '';
  return path.isAbsolute(p) ? p : path.resolve(opts.repoRoot, p);
}

function listFiles(dirPath, exts = null) {
  const out = [];
  if (!dirPath || !fs.existsSync(dirPath)) return out;
  const st = fs.statSync(dirPath);
  if (st.isFile()) return [dirPath];
  const ignored = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage']);
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, exts));
    else if (!exts || exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

function computeFileHash(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function computeDirTreeHash(dirRelOrAbs) {
  const abs = resolveInRepo(dirRelOrAbs);
  if (!abs || !fs.existsSync(abs)) return '';
  const files = listFiles(abs).sort();
  const hash = crypto.createHash('sha256');
  for (const f of files) {
    hash.update(path.relative(opts.repoRoot, f).replace(/\\/g, '/'));
    hash.update(fs.readFileSync(f));
  }
  return hash.digest('hex');
}

function getStateFilePath() {
  const dir = resolveInRepo(opts.changeDir);
  return dir ? path.join(dir, '.frontend-state.json') : '';
}

function readState() {
  const file = getStateFilePath();
  if (!file || !fs.existsSync(file)) {
    return { openapi_hash: '', revision_count: {}, diff_history: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      openapi_hash: parsed.openapi_hash || '',
      revision_count: parsed.revision_count || {},
      diff_history: Array.isArray(parsed.diff_history) ? parsed.diff_history : []
    };
  } catch {
    return { openapi_hash: '', revision_count: {}, diff_history: [] };
  }
}

function writeState(state) {
  const file = getStateFilePath();
  if (!file) return;
  const dir = path.dirname(file);
  if (fs.existsSync(dir)) {
    fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n', 'utf8');
  }
}

function recordNodeFailure(nodeName, snapshotHash) {
  if (!nodeName) return;
  const state = readState();
  const prev = Number(state.revision_count[nodeName] || 0) + 1;
  state.revision_count[nodeName] = prev;
  // Detectar ciclo A -> B -> A si el snapshot actual coincide con un estado fallido previo del mismo nodo
  const repeatedSnapshot = snapshotHash && state.diff_history.some(
    (h) => h.node === nodeName && h.status === 'failed' && h.snapshot_hash === snapshotHash
  );
  state.diff_history.push({
    node: nodeName,
    attempt: prev,
    status: 'failed',
    snapshot_hash: snapshotHash || '',
    ts: new Date().toISOString()
  });
  writeState(state);
  if (repeatedSnapshot) {
    fail(`REGRESIÓN EN diff_history: '${nodeName}' repitió exactamente el mismo estado fallido (${snapshotHash.slice(0, 12)}...). Escalar o cambiar enfoque.`);
  }
  if (prev > 3) {
    fail(`LÍMITE DURO SUPERADO: '${nodeName}' falló ${prev} veces consecutivas (> 3). Escalar a revisión humana.`);
  } else {
    warn(`Fallo #${prev}/3 registrado en .frontend-state.json para '${nodeName}'.`);
  }
}

function resetNodeRevision(nodeName, snapshotHash) {
  if (!nodeName) return;
  const state = readState();
  state.revision_count[nodeName] = 0;
  state.diff_history.push({
    node: nodeName,
    attempt: 0,
    status: 'passed',
    snapshot_hash: snapshotHash || '',
    ts: new Date().toISOString()
  });
  writeState(state);
  pass(`revision_count reiniciado y snapshot registrado en diff_history para '${nodeName}'.`);
}

function checkRegressionAgainstTests(nodeName) {
  if (!opts.testsDir || !nodeName || opts.snapshotTests || nodeName === 'qa') return;
  const state = readState();
  const lastTestsEntry = [...state.diff_history].reverse().find((h) => h.tests_hash);
  const currentTestsHash = computeDirTreeHash(opts.testsDir);
  if (lastTestsEntry && currentTestsHash && lastTestsEntry.tests_hash !== currentTestsHash) {
    fail(`REGRESIÓN DETECTADA en diff_history: '${nodeName}' alteró el hash de ${opts.testsDir} respecto al estado aprobado.`);
  }
}

function checkOpenApiDrift(updateIfEmpty = false) {
  const oaAbs = resolveInRepo(opts.openapiPath);
  if (!oaAbs || !fs.existsSync(oaAbs)) return '';
  const currentHash = computeFileHash(oaAbs);
  const state = readState();
  if (!state.openapi_hash && updateIfEmpty) {
    const cDirAbs = resolveInRepo(opts.changeDir);
    if (cDirAbs && fs.existsSync(cDirAbs)) {
      state.openapi_hash = currentHash;
      writeState(state);
      pass(`openapi_hash registrado en disco (${currentHash.slice(0, 12)}...).`);
    } else {
      pass(`openapi_hash calculado (${currentHash.slice(0, 12)}...); se persistirá en disco en Gate 2.`);
    }
  } else if (state.openapi_hash && state.openapi_hash !== currentHash) {
    fail(`DRIFT DE CONTRATO: openapi_hash cambió (${state.openapi_hash.slice(0, 12)} → ${currentHash.slice(0, 12)}). Retroceder al Paso 1 (Arquitecto).`);
  } else if (state.openapi_hash) {
    pass(`openapi_hash íntegro (${currentHash.slice(0, 12)}...).`);
  }
  return currentHash;
}

function getModifiedRepoPaths() {
  const pathsSet = new Set();
  const porcelain = execSync('git status --porcelain', { cwd: opts.repoRoot, encoding: 'utf8' });
  for (const line of porcelain.split(/\r?\n/)) {
    if (!line || line.length < 4) continue;
    const raw = line.slice(3).trim();
    if (raw.includes(' -> ')) {
      const [fromPath, toPath] = raw.split(' -> ').map((p) => p.replace(/^"|"$/g, '').replace(/\\/g, '/'));
      if (fromPath) pathsSet.add(fromPath);
      if (toPath) pathsSet.add(toPath);
    } else {
      pathsSet.add(raw.replace(/^"|"$/g, '').replace(/\\/g, '/'));
    }
  }
  const diffHead = execSync('git diff --name-only HEAD', { cwd: opts.repoRoot, encoding: 'utf8' });
  for (const p of diffHead.split(/\r?\n/).map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean)) {
    pathsSet.add(p);
  }
  return [...pathsSet];
}

function runShellCmd(label, cmd) {
  if (!cmd) return true;
  try {
    execSync(cmd, { cwd: opts.repoRoot, stdio: 'pipe', encoding: 'utf8' });
    pass(`${label} ejecutado con éxito.`);
    return true;
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || '').trim().slice(0, 600);
    fail(`${label} falló: ${detail}`);
    return false;
  }
}

function runGate1() {
  const cfg = path.join(opts.repoRoot, 'openspec', 'config.yaml');
  if (fs.existsSync(cfg)) pass('openspec/config.yaml detectado.');
  else fail('Falta openspec/config.yaml. Ejecuta primero _skills/sdd-init/SKILL.md.');

  const oaAbs = resolveInRepo(opts.openapiPath);
  if (opts.contractMode === 'none') {
    pass('Modo contract-mode=none (UI pura sin API): no requiere OpenAPI.');
  } else if (opts.contractMode === 'contract-first') {
    if (!oaAbs || !fs.existsSync(oaAbs)) {
      fail('Gate 1 (contract-first): Falta archivo OpenAPI válido (--openapi-path). Bloqueado para evitar alucinación de contratos.');
    } else {
      const content = fs.readFileSync(oaAbs, 'utf8');
      if (!/openapi\s*[:"]/i.test(content) || !/paths\s*[:"]/i.test(content)) {
        fail(`Gate 1: El archivo OpenAPI (${opts.openapiPath}) no contiene claves mínimas 'openapi' y 'paths'.`);
      } else {
        pass(`Contrato OpenAPI válido encontrado en ${opts.openapiPath}.`);
        checkOpenApiDrift(true);
      }
    }
  } else {
    if (oaAbs && fs.existsSync(oaAbs)) {
      pass(`Modo frontend-driven con OpenAPI existente (${opts.openapiPath}).`);
      checkOpenApiDrift(true);
    } else {
      warn('Modo frontend-driven: sin OpenAPI previo en Gate 1; frontend-architect-agent deberá generarlo en Paso 1.');
    }
  }
}

function runGate2() {
  const cDir = resolveInRepo(opts.changeDir);
  if (!cDir || !fs.existsSync(cDir)) {
    fail(`Gate 2: No existe la carpeta del cambio (--change-dir: ${opts.changeDir || 'vacío'}).`);
    return;
  }
  for (const f of ['proposal.md', 'design.md', 'tasks.md']) {
    const p = path.join(cDir, f);
    if (fs.existsSync(p) && fs.readFileSync(p, 'utf8').trim().length > 0) pass(`Artefacto ${f} presente.`);
    else fail(`Gate 2: Falta o está vacío ${f} en ${opts.changeDir}.`);
  }
  const specFiles = listFiles(path.join(cDir, 'specs'), ['.md']);
  if (specFiles.length > 0) pass(`${specFiles.length} archivo(s) spec.md encontrados.`);
  else fail('Gate 2: No se encontraron archivos specs/<capability>/spec.md.');

  const oaAbs = resolveInRepo(opts.openapiPath);
  if (opts.contractMode === 'none') {
    pass('Modo contract-mode=none: Gate 2 completado sin OpenAPI.');
  } else if (oaAbs && fs.existsSync(oaAbs)) {
    const state = readState();
    const h = computeFileHash(oaAbs);
    state.openapi_hash = h;
    writeState(state);
    pass(`OpenAPI validado y hash fijado en Gate 2 (${h.slice(0, 12)}...).`);
  } else if (opts.contractMode === 'frontend-driven') {
    fail('Gate 2 (frontend-driven): El borrador OpenAPI (--openapi-path) debe existir tras opsx:propose.');
  }
}

function runGate3() {
  checkOpenApiDrift(false);
  checkRegressionAgainstTests(opts.node);

  if (opts.protectedDirs) {
    try {
      const modified = getModifiedRepoPaths();
      const protList = opts.protectedDirs.split(',').map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean);
      const violations = modified.filter((m) => protList.some((p) => m === p || m.startsWith(p.endsWith('/') ? p : p + '/')));
      if (violations.length > 0) {
        fail(`Inmutabilidad violada en rutas protegidas: ${violations.join(', ')}`);
      } else {
        pass('Inmutabilidad de capas protegidas verificada (0 cambios ni renames indebidos).');
      }
    } catch (err) {
      fail(`Gate 3: No se pudo verificar inmutabilidad con Git (${err.message}).`);
    }
  }

  const tDir = resolveInRepo(opts.testsDir);
  if (tDir && fs.existsSync(tDir)) {
    const testFiles = listFiles(tDir, ['.ts', '.tsx', '.js', '.jsx']);
    const badSelectors = [];
    for (const tf of testFiles) {
      const txt = fs.readFileSync(tf, 'utf8');
      if (/querySelector(?:All)?\s*\(\s*['"`]\.|getElementsByClassName\s*\(|\.toHaveClass\s*\(|\.className\b|\.classList\b/.test(txt)) {
        badSelectors.push(path.relative(opts.repoRoot, tf));
      }
    }
    if (badSelectors.length > 0) {
      fail(`Tests acoplados al diseño (selectores CSS prohibidos) en: ${badSelectors.join(', ')}`);
    } else if (testFiles.length > 0) {
      pass(`${testFiles.length} archivo(s) de test cumplen enfoque Design-Blind.`);
    }
  }

  runShellCmd('Linter', opts.lintCmd);
  runShellCmd('Typecheck', opts.typecheckCmd);
  runShellCmd('Build desarrollo', opts.buildDevCmd);
  runShellCmd('Suite de tests', opts.testCmd);
}

function runGate4() {
  checkOpenApiDrift(false);
  checkRegressionAgainstTests(opts.node);
  runShellCmd('Build producción', opts.buildProdCmd);
  runShellCmd('Suite de tests', opts.testCmd);

  const bDir = resolveInRepo(opts.bundleDir);
  if (bDir && fs.existsSync(bDir)) {
    const jsFiles = listFiles(bDir, ['.js', '.mjs']);
    const totalBytes = jsFiles.reduce((acc, f) => acc + fs.statSync(f).size, 0);
    const totalKb = Math.round((totalBytes / 1024) * 100) / 100;
    if (totalKb > opts.maxBundleKb) {
      fail(`Presupuesto de bundle excedido: ${totalKb} KB > ${opts.maxBundleKb} KB en ${opts.bundleDir}.`);
    } else {
      pass(`Bundle dentro de presupuesto: ${totalKb} KB <= ${opts.maxBundleKb} KB.`);
    }
  }
}

console.log(`${colors.bold}${colors.cyan}=== validate-frontend.js (Gate: ${opts.gate}) ===${colors.reset}`);
if (opts.gate === '1' || opts.gate === 'all') runGate1();
if (opts.gate === '2' || opts.gate === 'all') runGate2();
if (opts.gate === '3' || opts.gate === 'all') runGate3();
if (opts.gate === '4' || opts.gate === 'all') runGate4();

const snapshotHash = computeDirTreeHash(opts.frontendDir || opts.changeDir);
if (opts.recordFailure) {
  recordNodeFailure(opts.recordFailure, snapshotHash);
} else if (opts.node && errors.length > 0) {
  recordNodeFailure(opts.node, snapshotHash);
} else if (opts.resetRevision) {
  resetNodeRevision(opts.resetRevision, snapshotHash);
} else if (opts.node && errors.length === 0) {
  resetNodeRevision(opts.node, snapshotHash);
}

if (opts.snapshotTests && !opts.testsDir) {
  fail('--snapshot-tests requiere especificar --tests-dir con archivos de prueba.');
} else if (opts.testsDir && errors.length === 0 && (opts.snapshotTests || opts.gate === '3' || opts.gate === '4' || opts.gate === 'all')) {
  const state = readState();
  const testsHash = computeDirTreeHash(opts.testsDir);
  const lastTestsEntry = [...state.diff_history].reverse().find((h) => h.tests_hash);
  if (opts.snapshotTests && !testsHash) {
    fail(`--snapshot-tests: no se encontraron archivos en --tests-dir (${opts.testsDir}) para generar snapshot.`);
  } else if (testsHash && (!lastTestsEntry || opts.snapshotTests)) {
    state.diff_history.push({ node: opts.node || (opts.snapshotTests ? 'qa' : `gate-${opts.gate}`), status: 'tests-snapshot', tests_hash: testsHash, ts: new Date().toISOString() });
    writeState(state);
    if (opts.snapshotTests) pass(`Snapshot autorizado de tests_hash registrado (${testsHash.slice(0, 12)}...).`);
  }
}

for (const c of checks) console.log(c);
if (errors.length > 0) {
  console.error(`\n${colors.red}${colors.bold}RESULTADO: FALLIDO (${errors.length} error(es), ${warnings.length} advertencia(s))${colors.reset}`);
  process.exit(1);
}
console.log(`\n${colors.green}${colors.bold}RESULTADO: SUPERADO (${warnings.length} advertencia(s))${colors.reset}`);
process.exit(0);
