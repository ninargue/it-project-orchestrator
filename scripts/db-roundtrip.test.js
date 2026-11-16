#!/usr/bin/env node
/**
 * Suite de pruebas para scripts/db-roundtrip.js.
 * Ejecutar con: node --test scripts/db-roundtrip.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(__dirname, 'db-roundtrip.js');

function runRoundtrip(args, env = {}) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT_PATH, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

describe('scripts/db-roundtrip.js', () => {
  let tmp;
  let stateFile;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'db-roundtrip-'));
    stateFile = path.join(tmp, 'schema.txt');
    fs.writeFileSync(stateFile, 'TABLE users(id INT);\n');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('symmetric exitoso: up → down → up restaura y recrea el esquema idéntico', () => {
    const up = `node -e "const fs=require('fs');const f=process.argv[1];let c=fs.readFileSync(f,'utf8');if(!c.includes('orders'))c+='TABLE orders(id INT);\\n';fs.writeFileSync(f,c)" "${stateFile}"`;
    const down = `node -e "const fs=require('fs');const f=process.argv[1];let c=fs.readFileSync(f,'utf8').replace('TABLE orders(id INT);\\n','');fs.writeFileSync(f,c)" "${stateFile}"`;
    const snap = `node -e "process.stdout.write(require('fs').readFileSync(process.argv[1],'utf8'))" "${stateFile}"`;

    const res = runRoundtrip(['--mode', 'symmetric', '--up-cmd', up, '--down-cmd', down, '--snapshot-cmd', snap, '--json']);
    assert.equal(res.code, 0);
    const parsed = JSON.parse(res.out);
    assert.equal(parsed.status, 'passed');
    assert.equal(parsed.hashInitial, parsed.hashAfterDown);
    assert.equal(parsed.hashAfterUp, parsed.hashSecondUp);
  });

  it('symmetric falla con exit 1 si down deja residuos (ROUNDTRIP DOWN DRIFT)', () => {
    const up = `node -e "const fs=require('fs');fs.appendFileSync(process.argv[1],'TABLE orders(id INT);\\nINDEX idx_orders;\\n')" "${stateFile}"`;
    const down = `node -e "const fs=require('fs');let c=fs.readFileSync(process.argv[1],'utf8').replace('TABLE orders(id INT);\\n','');fs.writeFileSync(f=process.argv[1],c)" "${stateFile}"`;
    const snap = `node -e "process.stdout.write(require('fs').readFileSync(process.argv[1],'utf8'))" "${stateFile}"`;

    const res = runRoundtrip(['--mode', 'symmetric', '--up-cmd', up, '--down-cmd', down, '--snapshot-cmd', snap, '--json']);
    assert.equal(res.code, 1);
    const parsed = JSON.parse(res.out);
    assert.equal(parsed.status, 'down_drift');
  });

  it('forward-only exitoso cuando up es idempotente y falla si no lo es', () => {
    const snap = `node -e "process.stdout.write(require('fs').readFileSync(process.argv[1],'utf8'))" "${stateFile}"`;
    const upIdempotent = `node -e "const fs=require('fs');const f=process.argv[1];let c=fs.readFileSync(f,'utf8');if(!c.includes('orders'))fs.appendFileSync(f,'TABLE orders(id INT);\\n')" "${stateFile}"`;

    const ok = runRoundtrip(['--mode', 'forward-only', '--up-cmd', upIdempotent, '--snapshot-cmd', snap, '--json']);
    assert.equal(ok.code, 0);
    assert.equal(JSON.parse(ok.out).status, 'passed');

    const upNonIdempotent = `node -e "require('fs').appendFileSync(process.argv[1],'TABLE extra(id INT);\\n')" "${stateFile}"`;
    const bad = runRoundtrip(['--mode', 'forward-only', '--up-cmd', upNonIdempotent, '--snapshot-cmd', snap, '--json']);
    assert.equal(bad.code, 1);
    assert.equal(JSON.parse(bad.out).status, 'not_idempotent');
  });

  it('aborta con exit 2 si --test-url coincide con --dev-url', () => {
    const res = runRoundtrip([
      '--up-cmd', 'echo up',
      '--down-cmd', 'echo down',
      '--snapshot-cmd', 'echo snap',
      '--test-url', 'postgres://localhost:5432/app',
      '--dev-url', 'postgres://localhost:5432/app'
    ]);
    assert.equal(res.code, 2);
  });

  it('sale con exit 3 si faltan flags obligatorios', () => {
    const res = runRoundtrip(['--mode', 'symmetric', '--up-cmd', 'echo up']);
    assert.equal(res.code, 3);
  });
});
