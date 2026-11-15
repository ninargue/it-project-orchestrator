#!/usr/bin/env node
/**
 * Suite de pruebas deterministas (node:test, sin dependencias externas) para scripts/validate-db-migrations.js.
 * Ejecutar con: node --test scripts/validate-db-migrations.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('os');
const { execFileSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(__dirname, 'validate-db-migrations.js');

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

describe('validate-db-migrations.js', () => {
  let tmp;
  let migDir;
  let secDir;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'val-db-test-'));
    migDir = path.join(tmp, 'database', 'migrations');
    secDir = path.join(tmp, 'database', 'security');
    fs.mkdirSync(migDir, { recursive: true });
    fs.mkdirSync(secDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('sale con exit 3 cuando el directorio indicado no existe (sin falso verde)', () => {
    const missing = path.join(tmp, 'no-existe');
    const res = runValidator(['--migrations-dir', missing, '--no-rls'], tmp);
    assert.equal(res.code, 3);
    assert.match(res.out, /NADA QUE VALIDAR/);
  });

  it('sale con exit 3 cuando no hay migraciones en la carpeta vacía', () => {
    const res = runValidator(['--migrations-dir', migDir, '--no-rls'], tmp);
    assert.equal(res.code, 3);
    assert.match(res.out, /NADA QUE VALIDAR/);
  });

  it('sale con exit 3 e indica --sql-from-cmd cuando solo hay migraciones ORM no-SQL', () => {
    fs.writeFileSync(path.join(migDir, '20260101_init.ts'), 'export async function up() {}');
    const res = runValidator(['--migrations-dir', migDir, '--no-rls'], tmp);
    assert.equal(res.code, 3);
    assert.match(res.out, /--sql-from-cmd/);
  });

  it('acepta --sql-from-cmd generando SQL válido (exit 0)', () => {
    const sql = 'CREATE TABLE users (id INT PRIMARY KEY); CREATE TABLE orders (id INT PRIMARY KEY, user_id INT REFERENCES users(id)); CREATE INDEX idx_orders_user_id ON orders(user_id);';
    const src = path.join(tmp, 'orm_out.sql');
    fs.writeFileSync(src, sql);
    const cmd = `node -e "process.stdout.write(require('fs').readFileSync(process.argv[1],'utf8'))" "${src}"`;
    const res = runValidator(['--sql-from-cmd', cmd, '--no-rls', '--engine', 'postgres'], tmp);
    assert.equal(res.code, 0);
  });

  it('falla con exit 1 cuando --sql-from-cmd produce una FK sin índice', () => {
    const sql = 'CREATE TABLE users (id INT PRIMARY KEY); CREATE TABLE orders (id INT PRIMARY KEY, user_id INT REFERENCES users(id));';
    const src = path.join(tmp, 'orm_bad.sql');
    fs.writeFileSync(src, sql);
    const cmd = `node -e "process.stdout.write(require('fs').readFileSync(process.argv[1],'utf8'))" "${src}"`;
    const res = runValidator(['--sql-from-cmd', cmd, '--no-rls', '--engine', 'postgres'], tmp);
    assert.equal(res.code, 1);
    assert.match(res.out, /MISSING INDEX/);
  });

  it('sale con exit 3 cuando --sql-from-cmd devuelve salida vacía', () => {
    const cmd = 'node -e "console.log(\'\')"';
    const res = runValidator(['--sql-from-cmd', cmd, '--no-rls'], tmp);
    assert.equal(res.code, 3);
  });

  it('motor NoSQL sale con exit 3 por defecto y con exit 0 solo con --allow-nosql-skip', () => {
    const denied = runValidator(['--engine', 'mongodb'], tmp);
    assert.equal(denied.code, 3);
    assert.match(denied.out, /NOSQL NO SOPORTADO/);

    const allowed = runValidator(['--engine', 'mongodb', '--allow-nosql-skip'], tmp);
    assert.equal(allowed.code, 0);
  });

  it('modo symmetric falla si falta .down.sql y pasa cuando la pareja simétrica es válida', () => {
    fs.writeFileSync(
      path.join(migDir, '001_init.up.sql'),
      'CREATE TABLE items (id INT PRIMARY KEY, owner_id INT REFERENCES owners(id)); CREATE INDEX idx_items_owner ON items(owner_id);'
    );
    const missingDown = runValidator(['--migrations-dir', migDir, '--migration-mode', 'symmetric', '--no-rls'], tmp);
    assert.equal(missingDown.code, 1);
    assert.match(missingDown.out, /SIMETRÍA/);

    fs.writeFileSync(path.join(migDir, '001_init.down.sql'), 'DROP TABLE IF EXISTS items;');
    const valid = runValidator(['--migrations-dir', migDir, '--migration-mode', 'symmetric', '--no-rls'], tmp);
    assert.equal(valid.code, 0);
  });

  it('modo symmetric explícito falla si los archivos no usan sufijo .up.sql', () => {
    fs.writeFileSync(path.join(migDir, '001_init.sql'), 'CREATE TABLE items (id INT PRIMARY KEY);');
    const res = runValidator(['--migrations-dir', migDir, '--migration-mode', 'symmetric', '--no-rls'], tmp);
    assert.equal(res.code, 1);
    assert.match(res.out, /SIMETRÍA/);
  });

  it('soporta --json devolviendo estructura parseable', () => {
    fs.writeFileSync(path.join(migDir, '001_init.sql'), 'CREATE TABLE items (id INT PRIMARY KEY);');
    const res = runValidator(['--migrations-dir', migDir, '--migration-mode', 'forward-only', '--no-rls', '--json'], tmp);
    assert.equal(res.code, 0);
    const parsed = JSON.parse(res.out);
    assert.equal(parsed.status, 'passed');
    assert.equal(parsed.filesValidated, 1);
    assert.equal(parsed.failures.length, 0);
  });
});
