#!/usr/bin/env node
/**
 * Suite de pruebas deterministas (node:test, sin dependencias externas) para scripts/validate-backend.js.
 * Ejecutar con: node --test scripts/validate-backend.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(__dirname, 'validate-backend.js');

function runValidator(args, cwd) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT_PATH, ...args], {
      encoding: 'utf8',
      cwd: cwd || os.tmpdir(),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

describe('validate-backend.js', () => {
  let tmp;
  let dbDir;
  let backendDir;
  let testsDir;
  let changeDir;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'val-be-test-'));
    dbDir = path.join(tmp, 'database', 'migrations');
    backendDir = path.join(tmp, 'backend');
    testsDir = path.join(tmp, 'tests');
    changeDir = path.join(tmp, 'openspec', 'changes', '0001-ventas');
    fs.mkdirSync(dbDir, { recursive: true });
    fs.mkdirSync(backendDir, { recursive: true });
    fs.mkdirSync(testsDir, { recursive: true });
    fs.mkdirSync(path.join(changeDir, 'specs', 'ventas'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('Gate 1 acepta migraciones ORM no-SQL (.py, .ts) y --migration-exts personalizado', () => {
    fs.writeFileSync(path.join(dbDir, '001_init.py'), 'def upgrade(): pass\n');
    const resPy = runValidator(['--gate', '1', '--repo-root', tmp, '--db-mode', 'with-db', '--db-dirs', 'database/migrations'], tmp);
    assert.equal(resPy.code, 0);

    fs.rmSync(path.join(dbDir, '001_init.py'));
    fs.writeFileSync(path.join(dbDir, '001_init.kt'), 'class InitMigration\n');
    const resKt = runValidator(
      ['--gate', '1', '--repo-root', tmp, '--db-mode', 'with-db', '--db-dirs', 'database/migrations', '--migration-exts', 'kt'],
      tmp
    );
    assert.equal(resKt.code, 0);
  });

  it('Gate 1 falla si la carpeta de BD solo tiene archivos no válidos (ej. __init__.py o README.md)', () => {
    fs.writeFileSync(path.join(dbDir, '__init__.py'), '');
    fs.writeFileSync(path.join(dbDir, 'README.md'), '# migrations');
    const res = runValidator(['--gate', '1', '--repo-root', tmp, '--db-mode', 'with-db', '--db-dirs', 'database/migrations'], tmp);
    assert.equal(res.code, 1);
    assert.match(res.out, /\[Gate 1\]/);
  });

  it('Gate 3 mide inmutabilidad de BD contra instantánea inicial aunque haya archivos sin commitear en git', () => {
    fs.writeFileSync(path.join(dbDir, '001_init.sql'), 'CREATE TABLE sales (id INT PRIMARY KEY);');
    fs.writeFileSync(path.join(backendDir, 'service.ts'), 'export const ok = true;');

    const snap = runValidator(
      ['--action', 'snapshot-db', '--repo-root', tmp, '--change-dir', 'openspec/changes/0001-ventas', '--db-mode', 'with-db', '--db-dirs', 'database/migrations'],
      tmp
    );
    assert.equal(snap.code, 0);

    const g3Pass = runValidator(
      ['--gate', '3', '--repo-root', tmp, '--change-dir', 'openspec/changes/0001-ventas', '--backend-dir', 'backend', '--db-mode', 'with-db', '--db-dirs', 'database/migrations'],
      tmp
    );
    assert.equal(g3Pass.code, 0);
    assert.match(g3Pass.out, /instantánea inicial/);

    fs.writeFileSync(path.join(dbDir, '001_init.sql'), 'CREATE TABLE sales (id INT PRIMARY KEY, total NUMERIC);');
    const g3Fail = runValidator(
      ['--gate', '3', '--repo-root', tmp, '--change-dir', 'openspec/changes/0001-ventas', '--backend-dir', 'backend', '--db-mode', 'with-db', '--db-dirs', 'database/migrations'],
      tmp
    );
    assert.equal(g3Fail.code, 1);
    assert.match(g3Fail.out, /VIOLACIÓN DE INMUTABILIDAD DE BD/);
  });

  it('Gate 4 exige --test-cmd obligatorio y no aprueba solo por existencia de archivos', () => {
    fs.writeFileSync(path.join(testsDir, 'sales.test.ts'), 'it("creates sale", () => {});');
    const res = runValidator(['--gate', '4', '--repo-root', tmp, '--tests-dir', 'tests'], tmp);
    assert.equal(res.code, 1);
    assert.match(res.out, /--test-cmd/);
  });

  it('Gate 4 verifica huella congelada de tests tras snapshot-tests y falla si se modifican o agregan tests', () => {
    const testFile = path.join(testsDir, 'sales.test.ts');
    fs.writeFileSync(testFile, 'it("Valid sale: creates sale", () => {});\n');
    fs.writeFileSync(
      path.join(changeDir, 'specs', 'ventas', 'spec.md'),
      '### Requirement: Create sale\n#### Scenario: Valid sale\n- **GIVEN** payload\n- **WHEN** POST\n- **THEN** 201\n'
    );

    const snap = runValidator(
      ['--action', 'snapshot-tests', '--repo-root', tmp, '--change-dir', 'openspec/changes/0001-ventas', '--tests-dir', 'tests'],
      tmp
    );
    assert.equal(snap.code, 0);

    const passCmd = `"${process.execPath}" -e "process.exit(0)"`;
    const g4Pass = runValidator(
      ['--gate', '4', '--repo-root', tmp, '--change-dir', 'openspec/changes/0001-ventas', '--tests-dir', 'tests', '--test-cmd', passCmd, '--require-tests-freeze'],
      tmp
    );
    assert.equal(g4Pass.code, 0);
    assert.match(g4Pass.out, /Huella de tests congelados verificada/);
    assert.match(g4Pass.out, /Mapa Scenario -> test verificado/);

    // Implementador altera el test
    fs.writeFileSync(testFile, 'it("creates sale", () => { /* relaxed */ });\n');
    const g4Fail = runValidator(
      ['--gate', '4', '--repo-root', tmp, '--change-dir', 'openspec/changes/0001-ventas', '--tests-dir', 'tests', '--test-cmd', passCmd, '--require-tests-freeze'],
      tmp
    );
    assert.equal(g4Fail.code, 1);
    assert.match(g4Fail.out, /VIOLACIÓN DE CONGELAMIENTO DE TESTS/);
  });

  it('Gate 4 falla con --require-tests-freeze si no hubo snapshot-tests previo', () => {
    fs.writeFileSync(path.join(testsDir, 'sales.test.ts'), 'it("creates sale", () => {});\n');
    const passCmd = `"${process.execPath}" -e "process.exit(0)"`;
    const res = runValidator(
      ['--gate', '4', '--repo-root', tmp, '--change-dir', 'openspec/changes/0001-ventas', '--tests-dir', 'tests', '--test-cmd', passCmd, '--require-tests-freeze'],
      tmp
    );
    assert.equal(res.code, 1);
    assert.match(res.out, /Falta la huella de tests congelados/);
  });

  it('verify-red falla si los tests nacen en VERDE o por SyntaxError/import roto, y pasa en ROJO válido', () => {
    const greenCmd = `"${process.execPath}" -e "process.exit(0)"`;
    const resGreen = runValidator(['--action', 'verify-red', '--repo-root', tmp, '--test-cmd', greenCmd], tmp);
    assert.equal(resGreen.code, 1);
    assert.match(resGreen.out, /nació en VERDE/);

    const syntaxCmd = `"${process.execPath}" -e "console.error('SyntaxError: unexpected token'); process.exit(1)"`;
    const resSyntax = runValidator(['--action', 'verify-red', '--repo-root', tmp, '--test-cmd', syntaxCmd], tmp);
    assert.equal(resSyntax.code, 1);
    assert.match(resSyntax.out, /ROJO INVÁLIDO/);

    const validRedCmd = `"${process.execPath}" -e "console.error('AssertionError: expected 201 got 404'); process.exit(1)"`;
    const resValid = runValidator(['--action', 'verify-red', '--repo-root', tmp, '--test-cmd', validRedCmd], tmp);
    assert.equal(resValid.code, 0);
    assert.match(resValid.out, /ROJO válido verificado/);
  });
});
