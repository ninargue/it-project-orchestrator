#!/usr/bin/env node
/**
 * Suite de pruebas para scripts/db-verify-gate.js.
 * Ejecutar con: node --test scripts/db-verify-gate.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const GATE_SCRIPT = path.resolve(__dirname, 'db-verify-gate.js');
const FP_SCRIPT = path.resolve(__dirname, 'db-test-fingerprint.js');

function run(script, args) {
  try {
    const out = execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

describe('scripts/db-verify-gate.js', () => {
  let tmp;
  let changeDir;
  let testsDir;
  let migDir;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'db-gate-'));
    changeDir = path.join(tmp, 'openspec', 'changes', 'c1');
    testsDir = path.join(tmp, 'database', 'tests');
    migDir = path.join(tmp, 'database', 'migrations');
    fs.mkdirSync(changeDir, { recursive: true });
    fs.mkdirSync(testsDir, { recursive: true });
    fs.mkdirSync(migDir, { recursive: true });
    fs.writeFileSync(path.join(testsDir, 'items.test.sql'), 'SELECT 1;');
    fs.writeFileSync(path.join(migDir, '001.up.sql'), 'CREATE TABLE items (id INT PRIMARY KEY);');
    fs.writeFileSync(path.join(migDir, '001.down.sql'), 'DROP TABLE IF EXISTS items;');
    run(FP_SCRIPT, ['--action', 'freeze', '--change-dir', changeDir, '--tests-dir', testsDir]);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('emite [APROBADO] cuando validación, huella y tests pasan', () => {
    const res = run(GATE_SCRIPT, [
      '--change-dir', changeDir,
      '--tests-dir', testsDir,
      '--migrations-dir', migDir,
      '--no-rls',
      '--skip-roundtrip',
      '--test-cmd', 'node -e "process.exit(0)"',
      '--json'
    ]);
    assert.equal(res.code, 0);
    const parsed = JSON.parse(res.out);
    assert.equal(parsed.verdict, '[APROBADO]');
    assert.equal(parsed.passed, true);
  });

  it('emite [OBSERVADO CON CORRECCIONES REQUERIDAS] si los tests fueron alterados tras freeze', () => {
    fs.writeFileSync(path.join(testsDir, 'items.test.sql'), 'SELECT 999;');
    const res = run(GATE_SCRIPT, [
      '--change-dir', changeDir,
      '--tests-dir', testsDir,
      '--migrations-dir', migDir,
      '--no-rls',
      '--skip-roundtrip',
      '--test-cmd', 'node -e "process.exit(0)"',
      '--json'
    ]);
    assert.equal(res.code, 1);
    const parsed = JSON.parse(res.out);
    assert.equal(parsed.verdict, '[OBSERVADO CON CORRECCIONES REQUERIDAS]');
    assert.equal(parsed.gates.find((g) => g.name === 'db-test-fingerprint').ok, false);
  });
});
