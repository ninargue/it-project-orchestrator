#!/usr/bin/env node
/**
 * Suite de pruebas deterministas (node:test, sin dependencias externas) para scripts/validate-frontend.js.
 * Ejecutar con: node --test scripts/validate-frontend.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(__dirname, 'validate-frontend.js');

function runValidator(args) {
  try {
    const out = execSync(`node "${SCRIPT_PATH}" ${args}`, { encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status || 1, out: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

describe('validate-frontend.js (Gates 1-4)', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'val-fe-test-'));
    fs.mkdirSync(path.join(tmp, 'openspec/changes/c1/specs/cart'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'src/tests'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'dist/assets'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'openspec/config.yaml'), 'schema: spec-driven\n');
    fs.writeFileSync(path.join(tmp, 'openapi.yaml'), 'openapi: 3.0.0\npaths: {}\n');
    fs.writeFileSync(path.join(tmp, 'openspec/changes/c1/proposal.md'), '# Proposal');
    fs.writeFileSync(path.join(tmp, 'openspec/changes/c1/design.md'), '# Design');
    fs.writeFileSync(path.join(tmp, 'openspec/changes/c1/tasks.md'), '- [x] task');
    fs.writeFileSync(path.join(tmp, 'openspec/changes/c1/specs/cart/spec.md'), '# Spec');
    fs.writeFileSync(path.join(tmp, 'dist/assets/index.js'), Buffer.alloc(1024 * 10));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('Gate 1: permite contract-mode=none sin OpenAPI y bloquea contract-first sin OpenAPI', () => {
    const resNone = runValidator(`--gate 1 --repo-root "${tmp}" --contract-mode none`);
    assert.equal(resNone.code, 0);

    fs.rmSync(path.join(tmp, 'openapi.yaml'));
    const resFail = runValidator(`--gate 1 --repo-root "${tmp}" --contract-mode contract-first --openapi-path openapi.yaml`);
    assert.notEqual(resFail.code, 0);
  });

  it('Gate 1 y Gate 2: valida OpenSpec y registra openapi_hash en .frontend-state.json', () => {
    const g1 = runValidator(`--gate 1 --repo-root "${tmp}" --contract-mode contract-first --openapi-path openapi.yaml --change-dir openspec/changes/c1`);
    assert.equal(g1.code, 0);

    const g2 = runValidator(`--gate 2 --repo-root "${tmp}" --contract-mode contract-first --openapi-path openapi.yaml --change-dir openspec/changes/c1`);
    assert.equal(g2.code, 0);

    const state = JSON.parse(fs.readFileSync(path.join(tmp, 'openspec/changes/c1/.frontend-state.json'), 'utf8'));
    assert.equal(state.openapi_hash.length, 64);
  });

  it('Gate 3: rechaza selectores acoplados al diseño y acepta tests Design-Blind', () => {
    fs.writeFileSync(path.join(tmp, 'src/tests/cart.test.tsx'), 'expect(el).toHaveClass("btn");');
    const bad = runValidator(`--gate 3 --repo-root "${tmp}" --change-dir openspec/changes/c1 --openapi-path openapi.yaml --tests-dir src/tests --node maquetador`);
    assert.notEqual(bad.code, 0);

    fs.writeFileSync(path.join(tmp, 'src/tests/cart.test.tsx'), 'screen.getByRole("button", { name: /cobrar/i });');
    const good = runValidator(`--gate 3 --repo-root "${tmp}" --change-dir openspec/changes/c1 --openapi-path openapi.yaml --tests-dir src/tests --node maquetador`);
    assert.equal(good.code, 0);
  });

  it('Gate 3: detecta drift de openapi_hash, alteración en diff_history y límite revision_count > 3', () => {
    runValidator(`--gate 2 --repo-root "${tmp}" --contract-mode contract-first --openapi-path openapi.yaml --change-dir openspec/changes/c1`);
    fs.writeFileSync(path.join(tmp, 'src/tests/cart.test.tsx'), 'screen.getByRole("button");');
    runValidator(`--gate 3 --repo-root "${tmp}" --change-dir openspec/changes/c1 --openapi-path openapi.yaml --tests-dir src/tests --node qa`);

    // Alterar tests luego de snapshot -> diff_history debe fallar para integrador
    fs.writeFileSync(path.join(tmp, 'src/tests/cart.test.tsx'), 'screen.getByRole("link");');
    const reg = runValidator(`--gate 3 --repo-root "${tmp}" --change-dir openspec/changes/c1 --openapi-path openapi.yaml --tests-dir src/tests --node integrador`);
    assert.notEqual(reg.code, 0);

    // Actualizar snapshot autorizado vía --snapshot-tests --node qa -> debe desbloquear Gate 3
    const snap = runValidator(`--gate none --snapshot-tests --repo-root "${tmp}" --change-dir openspec/changes/c1 --tests-dir src/tests --node qa`);
    assert.equal(snap.code, 0);
    const unlocked = runValidator(`--gate 3 --repo-root "${tmp}" --change-dir openspec/changes/c1 --openapi-path openapi.yaml --tests-dir src/tests --node integrador`);
    assert.equal(unlocked.code, 0);

    // Drift de OpenAPI
    fs.writeFileSync(path.join(tmp, 'openapi.yaml'), 'openapi: 3.1.0\npaths: { "/v2": {} }\n');
    const drift = runValidator(`--gate 3 --repo-root "${tmp}" --change-dir openspec/changes/c1 --openapi-path openapi.yaml --node integrador`);
    assert.notEqual(drift.code, 0);

    // Límite revision_count > 3
    for (let i = 0; i < 3; i++) {
      runValidator(`--gate 1 --repo-root "${tmp}" --contract-mode none --change-dir openspec/changes/c1 --record-failure auditor`);
    }
    const fourth = runValidator(`--gate 1 --repo-root "${tmp}" --contract-mode none --change-dir openspec/changes/c1 --record-failure auditor`);
    assert.notEqual(fourth.code, 0);
  });

  it('Gate 4: valida presupuesto de tamaño de bundle', () => {
    const ok = runValidator(`--gate 4 --repo-root "${tmp}" --change-dir openspec/changes/c1 --bundle-dir dist/assets --max-bundle-kb 250 --node auditor`);
    assert.equal(ok.code, 0);

    const over = runValidator(`--gate 4 --repo-root "${tmp}" --change-dir openspec/changes/c1 --bundle-dir dist/assets --max-bundle-kb 5 --node auditor`);
    assert.notEqual(over.code, 0);
  });
});
