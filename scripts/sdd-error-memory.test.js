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

  await t.test('record normaliza rutas/números y detecta loop al repetir firma 2 veces (exit 2)', () => {
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

    // Misma firma con distinta línea/ruta debe disparar loop_detected (exit 2)
    const r2 = runCli([
      '--action', 'record',
      '--change-dir', changeDir,
      '--layer', 'backend',
      '--step', 'Gate 3',
      '--message', 'TypeError at /repo/src/service.ts:99'
    ]);
    assert.equal(r2.code, 2);
    const p2 = JSON.parse(r2.stdout);
    assert.equal(p2.attempt, 2);
    assert.equal(p2.error_signature, p1.error_signature);
    assert.equal(p2.consecutive_same_signature, 2);
    assert.equal(p2.loop_detected, true);
  });

  await t.test('summary devuelve restricciones avoid y errores recientes compactos', () => {
    const res = runCli(['--action', 'summary', '--change-dir', changeDir]);
    assert.equal(res.code, 0);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.attempt, 2);
    assert.equal(parsed.loop_detected, true);
    assert.deepEqual(parsed.avoid, ['No importar el DTO antes de compilar schemas']);
    assert.equal(parsed.recent_errors.length, 2);
  });

  await t.test('promote escribe known-gotchas.md por capa sin duplicar reglas', () => {
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

    const r2 = runCli([
      '--action', 'promote',
      '--change-dir', changeDir,
      '--specs-dir', specsDir,
      '--layer', 'backend',
      '--rule', 'Compilar DTOs antes de ejecutar typecheck en backend'
    ]);
    assert.equal(r2.code, 0);
    const p2 = JSON.parse(r2.stdout);
    assert.equal(p2.promoted, false);
    assert.equal(p2.duplicate, true);
    assert.equal(p2.total_rules, 1);
  });
});
