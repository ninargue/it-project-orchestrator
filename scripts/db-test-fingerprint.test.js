#!/usr/bin/env node
/**
 * Suite de pruebas para scripts/db-test-fingerprint.js.
 * Ejecutar con: node --test scripts/db-test-fingerprint.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, 'db-test-fingerprint.js');

function run(args) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

describe('scripts/db-test-fingerprint.js', () => {
  let tmp;
  let changeDir;
  let testsDir;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'db-fp-'));
    changeDir = path.join(tmp, 'openspec', 'changes', 'c1');
    testsDir = path.join(tmp, 'database', 'tests');
    fs.mkdirSync(changeDir, { recursive: true });
    fs.mkdirSync(testsDir, { recursive: true });
    fs.writeFileSync(path.join(testsDir, 'users.test.sql'), 'SELECT 1;');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('freeze guarda huella en .sdd-state.json y verify pasa si no hay cambios', () => {
    const f = run(['--action', 'freeze', '--change-dir', changeDir, '--tests-dir', testsDir, '--json']);
    assert.equal(f.code, 0);
    assert.equal(JSON.parse(f.out).status, 'frozen');

    const v = run(['--action', 'verify', '--change-dir', changeDir, '--tests-dir', testsDir, '--json']);
    assert.equal(v.code, 0);
    assert.equal(JSON.parse(v.out).status, 'verified');
  });

  it('verify falla si se modifica, agrega o elimina un test tras el freeze', () => {
    run(['--action', 'freeze', '--change-dir', changeDir, '--tests-dir', testsDir]);
    fs.writeFileSync(path.join(testsDir, 'users.test.sql'), 'SELECT 2; -- relajado');
    const v = run(['--action', 'verify', '--change-dir', changeDir, '--tests-dir', testsDir, '--json']);
    assert.equal(v.code, 1);
    assert.equal(JSON.parse(v.out).status, 'tampered');
  });

  it('impide segundo freeze sin refreeze y permite refreeze solo con --reason', () => {
    run(['--action', 'freeze', '--change-dir', changeDir, '--tests-dir', testsDir]);
    const secondFreeze = run(['--action', 'freeze', '--change-dir', changeDir, '--tests-dir', testsDir]);
    assert.equal(secondFreeze.code, 1);

    const noReason = run(['--action', 'refreeze', '--change-dir', changeDir, '--tests-dir', testsDir]);
    assert.equal(noReason.code, 3);

    fs.writeFileSync(path.join(testsDir, 'users.test.sql'), 'SELECT 1; -- reforzado por M4');
    const okRefreeze = run(['--action', 'refreeze', '--change-dir', changeDir, '--tests-dir', testsDir, '--reason', 'Refuerzo M4']);
    assert.equal(okRefreeze.code, 0);

    const v = run(['--action', 'verify', '--change-dir', changeDir, '--tests-dir', testsDir]);
    assert.equal(v.code, 0);
  });
});
