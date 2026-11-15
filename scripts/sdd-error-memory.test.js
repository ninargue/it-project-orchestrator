const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const scriptPath = path.resolve(__dirname, 'sdd-error-memory.js');

function runCli(cliArgs) {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath, ...cliArgs], { encoding: 'utf8' });
    return { code: 0, stdout: stdout.trim() };
  } catch (err) {
    return { code: err.status, stdout: (err.stdout || '').trim(), stderr: (err.stderr || '').trim() };
  }
}

test('sdd-error-memory.js (Opción 3: .sdd-state.json + known-gotchas.md)', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-err-mem-'));
  const changeDir = path.join(tmpDir, 'openspec', 'changes', '0001-pos-backend');
  const specsDir = path.join(tmpDir, 'openspec', 'specs');
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  await t.test('init crea .sdd-state.json de forma idempotente', () => {
    const res = runCli(['--action', 'init', '--change-dir', changeDir, '--layer', 'backend']);
    assert.equal(res.code, 0);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.initialized, true);
    assert.equal(fs.existsSync(path.join(changeDir, '.sdd-state.json')), true);
  });

  await t.test('record es 100% agnóstico al SO (Windows \\, Windows /, file:///, Unix /, relativo y TS(line,col))', () => {
    const r1 = runCli([
      '--action', 'record',
      '--change-dir', changeDir,
      '--layer', 'backend',
      '--step', 'Gate 3',
      '--message', 'TypeError at C:\\repo\\src\\service.ts:42',
      '--avoid', 'No importar el DTO antes de compilar schemas'
    ]);
    assert.equal(r1.code, 0);
    const p1 = JSON.parse(r1.stdout);
    assert.equal(p1.attempt, 1);
    assert.equal(p1.loop_detected, false);

    // Misma firma en Windows con forward slashes (C:/...) debe producir idéntica firma y disparar exit 2
    const r2 = runCli([
      '--action', 'record',
      '--change-dir', changeDir,
      '--layer', 'backend',
      '--step', 'Gate 3',
      '--message', 'TypeError at C:/repo/src/service.ts:99:12'
    ]);
    assert.equal(r2.code, 2);
    const p2 = JSON.parse(r2.stdout);
    assert.equal(p2.attempt, 2);
    assert.equal(p2.error_signature, p1.error_signature);
    assert.equal(p2.consecutive_same_signature, 2);
    assert.equal(p2.loop_detected, true);

    // Un error distinto en el medio reinicia consecutive_same_signature a 1 (exit 0)
    const rDiff = runCli([
      '--action', 'record',
      '--change-dir', changeDir,
      '--layer', 'backend',
      '--step', 'Gate 3',
      '--message', 'SyntaxError: Unexpected token in payload',
      '--avoid', 'Validar JSON de entrada'
    ]);
    assert.equal(rDiff.code, 0);
    const pDiff = JSON.parse(rDiff.stdout);
    assert.notEqual(pDiff.error_signature, p1.error_signature);
    assert.equal(pDiff.consecutive_same_signature, 1);
    assert.equal(pDiff.loop_detected, false);

    // Volver al primer error en formato Unix (/repo/...) o TS relativo (src\service.ts(10,5)) cuenta como 1ra vez consecutiva
    const rUnix = runCli([
      '--action', 'record',
      '--change-dir', changeDir,
      '--layer', 'backend',
      '--step', 'Gate 3',
      '--message', 'TypeError at /repo/src/service.ts:15'
    ]);
    assert.equal(rUnix.code, 0);
    const pUnix = JSON.parse(rUnix.stdout);
    assert.equal(pUnix.error_signature, p1.error_signature);
    assert.equal(pUnix.consecutive_same_signature, 1);

    // Repetir ahora con formato TypeScript (line,col) o file:/// vuelve a disparar loop_detected (exit 2)
    const rTs = runCli([
      '--action', 'record',
      '--change-dir', changeDir,
      '--layer', 'backend',
      '--step', 'Gate 3',
      '--message', 'TypeError at src\\service.ts(10, 5)'
    ]);
    assert.equal(rTs.code, 2);
    const pTs = JSON.parse(rTs.stdout);
    assert.equal(pTs.error_signature, p1.error_signature);
    assert.equal(pTs.consecutive_same_signature, 2);
    assert.equal(pTs.loop_detected, true);
  });

  await t.test('summary devuelve restricciones avoid sin duplicados y últimos 3 errores', () => {
    const res = runCli(['--action', 'summary', '--change-dir', changeDir]);
    assert.equal(res.code, 0);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.attempt, 5);
    assert.equal(parsed.loop_detected, true);
    assert.deepEqual(parsed.avoid, [
      'No importar el DTO antes de compilar schemas',
      'Validar JSON de entrada'
    ]);
    assert.equal(parsed.recent_errors.length, 3);
  });

  await t.test('promote deduplica por regla canónica sin falsos positivos con el header o subcadenas', () => {
    const r1 = runCli([
      '--action', 'promote',
      '--change-dir', changeDir,
      '--specs-dir', specsDir,
      '--layer', 'backend',
      '--rule', 'Compilar DTOs antes de ejecutar typecheck en backend',
      '--context', '0001-pos-backend'
    ]);
    assert.equal(r1.code, 0);
    const p1 = JSON.parse(r1.stdout);
    assert.equal(p1.promoted, true);
    assert.equal(p1.total_rules, 1);

    // Misma regla exacta (incluso sin --context o con salto de línea) se detecta como duplicada
    const r2 = runCli([
      '--action', 'promote',
      '--change-dir', changeDir,
      '--specs-dir', specsDir,
      '--layer', 'backend',
      '--rule', 'Compilar DTOs antes de\nejecutar typecheck en backend'
    ]);
    assert.equal(r2.code, 0);
    const p2 = JSON.parse(r2.stdout);
    assert.equal(p2.promoted, false);
    assert.equal(p2.duplicate, true);
    assert.equal(p2.total_rules, 1);

    // Regla más corta que es subcadena de la primera o usa palabras del header ("backend", "opsx:explore") NO debe ser falso positivo
    const r3 = runCli([
      '--action', 'promote',
      '--change-dir', changeDir,
      '--specs-dir', specsDir,
      '--layer', 'backend',
      '--rule', 'Ejecutar typecheck en backend'
    ]);
    assert.equal(r3.code, 0);
    const p3 = JSON.parse(r3.stdout);
    assert.equal(p3.promoted, true);
    assert.equal(p3.duplicate, false);
    assert.equal(p3.total_rules, 2);
  });

  await t.test('valida capas inválidas y flags sin valor', () => {
    const badLayer = runCli([
      '--action', 'promote',
      '--specs-dir', specsDir,
      '--layer', '../etc',
      '--rule', 'Regla inválida'
    ]);
    assert.equal(badLayer.code, 1);

    const missingVal = runCli([
      '--action', 'record',
      '--change-dir', changeDir,
      '--step', '--message', 'Error sin valor de step'
    ]);
    assert.equal(missingVal.code, 1);
  });
});
