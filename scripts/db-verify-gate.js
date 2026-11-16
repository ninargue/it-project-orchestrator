#!/usr/bin/env node
/**
 * Gate determinista e independiente del dictamen final para la capa de base de datos.
 * Evita que db-qa-agent se evalúe a sí mismo: ejecuta en secuencia:
 *   1. validate-db-migrations.js
 *   2. db-roundtrip.js (salvo --skip-roundtrip)
 *   3. db-test-fingerprint.js --action verify
 *   4. test-cmd del proyecto
 *
 * Emite [APROBADO] (exit 0) o [OBSERVADO CON CORRECCIONES REQUERIDAS] (exit 1).
 */

const path = require('path');
const { execFileSync, execSync } = require('child_process');

const args = process.argv.slice(2);
let changeDir = '';
let testsDir = '';
let migrationsDir = '';
let securityDir = '';
let noRls = false;
let engine = 'postgres';
let migrationMode = 'symmetric';
let sqlFromCmd = '';
let testCmd = '';
let upCmd = '';
let downCmd = '';
let snapshotCmd = '';
let schemaCodegenCmd = '';
let typecheckCmd = '';
let skipRoundtrip = false;
let jsonOutput = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--change-dir') changeDir = args[++i] || '';
  else if (a === '--tests-dir') testsDir = args[++i] || '';
  else if (a === '--migrations-dir') migrationsDir = args[++i] || '';
  else if (a === '--security-dir') securityDir = args[++i] || '';
  else if (a === '--no-rls') noRls = true;
  else if (a === '--engine') engine = args[++i] || 'postgres';
  else if (a === '--migration-mode') migrationMode = args[++i] || 'symmetric';
  else if (a === '--sql-from-cmd') sqlFromCmd = args[++i] || '';
  else if (a === '--test-cmd') testCmd = args[++i] || '';
  else if (a === '--up-cmd') upCmd = args[++i] || '';
  else if (a === '--down-cmd') downCmd = args[++i] || '';
  else if (a === '--snapshot-cmd') snapshotCmd = args[++i] || '';
  else if (a === '--schema-codegen-cmd') schemaCodegenCmd = args[++i] || '';
  else if (a === '--typecheck-cmd') typecheckCmd = args[++i] || '';
  else if (a === '--skip-roundtrip') skipRoundtrip = true;
  else if (a === '--json') jsonOutput = true;
}

if (!changeDir || !testsDir || !testCmd) {
  console.error('❌ [DB-VERIFY-GATE]: Faltan flags obligatorios (--change-dir, --tests-dir, --test-cmd).');
  process.exit(3);
}

function runNodeScript(scriptName, scriptArgs) {
  const fullPath = path.resolve(__dirname, scriptName);
  try {
    const out = execFileSync(process.execPath, [fullPath, ...scriptArgs], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { ok: true, code: 0, out: out.trim() };
  } catch (err) {
    return {
      ok: false,
      code: err.status ?? 1,
      out: `${err.stdout || ''}${err.stderr || ''}`.trim()
    };
  }
}

const gates = [];

// 1. Validación estática
const valArgs = ['--engine', engine, '--migration-mode', migrationMode, '--json'];
if (migrationsDir) valArgs.push('--migrations-dir', migrationsDir);
if (noRls) valArgs.push('--no-rls');
else if (securityDir) valArgs.push('--security-dir', securityDir);
if (sqlFromCmd) valArgs.push('--sql-from-cmd', sqlFromCmd);

const valRes = runNodeScript('validate-db-migrations.js', valArgs);
gates.push({ name: 'validate-db-migrations', ...valRes });

// 2. Roundtrip real (si no se omite)
if (!skipRoundtrip) {
  if (!upCmd || !snapshotCmd || (migrationMode === 'symmetric' && !downCmd)) {
    gates.push({
      name: 'db-roundtrip',
      ok: false,
      code: 3,
      out: 'Faltan --up-cmd, --snapshot-cmd (y --down-cmd en symmetric) para ejecutar roundtrip.'
    });
  } else {
    const rtArgs = ['--mode', migrationMode, '--up-cmd', upCmd, '--snapshot-cmd', snapshotCmd, '--json'];
    if (downCmd) rtArgs.push('--down-cmd', downCmd);
    const rtRes = runNodeScript('db-roundtrip.js', rtArgs);
    gates.push({ name: 'db-roundtrip', ...rtRes });
  }
}

// 3. Huella de tests
const fpRes = runNodeScript('db-test-fingerprint.js', [
  '--action', 'verify',
  '--change-dir', changeDir,
  '--tests-dir', testsDir,
  '--json'
]);
gates.push({ name: 'db-test-fingerprint', ...fpRes });

// 4. Suite de tests en VERDE
let testRes;
try {
  const out = execSync(testCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  testRes = { name: 'test-suite', ok: true, code: 0, out: out.trim() };
} catch (err) {
  testRes = {
    name: 'test-suite',
    ok: false,
    code: err.status ?? 1,
    out: `${err.stdout || ''}${err.stderr || ''}`.trim()
  };
}
gates.push(testRes);

// 5. Codegen de esquema y chequeo de tipos post-migración (si se configuraron)
for (const [gateName, cmd] of [['schema-codegen', schemaCodegenCmd], ['typecheck', typecheckCmd]]) {
  if (!cmd) continue;
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    gates.push({ name: gateName, ok: true, code: 0, out: out.trim() });
  } catch (err) {
    gates.push({
      name: gateName,
      ok: false,
      code: err.status ?? 1,
      out: `${err.stdout || ''}${err.stderr || ''}`.trim()
    });
  }
}

const allPassed = gates.every((g) => g.ok);
const verdict = allPassed ? '[APROBADO]' : '[OBSERVADO CON CORRECCIONES REQUERIDAS]';

if (jsonOutput) {
  console.log(JSON.stringify({
    verdict,
    passed: allPassed,
    gates: gates.map((g) => ({ name: g.name, ok: g.ok, code: g.code }))
  }, null, 2));
} else {
  console.log(`📊 Dictamen DB-Verify-Gate: ${verdict}`);
  for (const g of gates) {
    console.log(`  ${g.ok ? '✅' : '❌'} ${g.name} (exit ${g.code})`);
  }
}

process.exit(allPassed ? 0 : 1);
