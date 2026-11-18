'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { classifyArchiveOrCommitCommand } = require('./archive-commit.js');

function makeTempChange(changeName, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-commit-test-'));
  const changeDir = path.join(root, 'openspec', 'changes', changeName);
  fs.mkdirSync(changeDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(changeDir, name), content, 'utf8');
  }
  return root;
}

describe('hooks/guards/archive-commit.js', () => {
  it('bloquea encadenar openspec archive y git commit en un mismo comando', () => {
    const res = classifyArchiveOrCommitCommand('openspec archive feat-db && git commit -m "feat(db): cierre"');
    assert.equal(res.deny, true);
    assert.equal(res.rule, 'no-chained-archive-commit');
  });

  it('bloquea encadenar verificación/tests con openspec archive', () => {
    const res = classifyArchiveOrCommitCommand('node scripts/db-verify-gate.js && openspec archive feat-db');
    assert.equal(res.deny, true);
    assert.equal(res.rule, 'no-chained-verify-archive-commit');
  });

  it('bloquea encadenar tests con git commit', () => {
    const res = classifyArchiveOrCommitCommand('node --test && git add . && git commit -m "feat: ok"');
    assert.equal(res.deny, true);
    assert.equal(res.rule, 'no-chained-verify-archive-commit');
  });

  it('bloquea openspec archive si falta verification-report.md', () => {
    const cwd = makeTempChange('feat-db', { 'tasks.md': '- [x] Hecho\n' });
    const res = classifyArchiveOrCommitCommand('openspec archive feat-db', { cwd });
    assert.equal(res.deny, true);
    assert.equal(res.rule, 'archive-missing-verification-report');
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('bloquea openspec archive si verification-report.md no está [APROBADO]', () => {
    const cwd = makeTempChange('feat-db', {
      'verification-report.md': 'Veredicto: [OBSERVADO CON CORRECCIONES REQUERIDAS]\n',
      'tasks.md': '- [x] Hecho\n'
    });
    const res = classifyArchiveOrCommitCommand('openspec archive feat-db', { cwd });
    assert.equal(res.deny, true);
    assert.equal(res.rule, 'archive-requires-approved-verify');
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('bloquea openspec archive si mutation-report.md tiene tests complacientes', () => {
    const cwd = makeTempChange('feat-db', {
      'verification-report.md': 'Veredicto: [APROBADO]\n',
      'mutation-report.md': 'Estado: [TESTS COMPLACIENTES DETECTADOS]\n',
      'tasks.md': '- [x] Hecho\n'
    });
    const res = classifyArchiveOrCommitCommand('openspec archive feat-db', { cwd });
    assert.equal(res.deny, true);
    assert.equal(res.rule, 'archive-blocked-by-mutation-report');
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('bloquea openspec archive si tasks.md tiene tareas pendientes', () => {
    const cwd = makeTempChange('feat-db', {
      'verification-report.md': 'Veredicto: [APROBADO]\n',
      'tasks.md': '- [x] Paso 1\n- [ ] Paso 2\n'
    });
    const res = classifyArchiveOrCommitCommand('openspec archive feat-db', { cwd });
    assert.equal(res.deny, true);
    assert.equal(res.rule, 'archive-incomplete-tasks');
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('permite openspec archive aislado cuando verification-report.md está [APROBADO] y tasks completas', () => {
    const cwd = makeTempChange('feat-db', {
      'verification-report.md': 'Veredicto: [APROBADO]\n',
      'mutation-report.md': 'Estado: [TESTS BLINDADOS]\n',
      'tasks.md': '- [x] Paso 1\n'
    });
    const res = classifyArchiveOrCommitCommand('openspec archive feat-db', { cwd });
    assert.equal(res.deny, false);
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it('permite git add && git commit aislado cuando no hay reportes fallidos activos', () => {
    const cwd = makeTempChange('feat-db', {
      'verification-report.md': 'Veredicto: [APROBADO]\n'
    });
    const res = classifyArchiveOrCommitCommand('git add database/ openspec/ && git commit -m "feat(db): cierre"', { cwd });
    assert.equal(res.deny, false);
    fs.rmSync(cwd, { recursive: true, force: true });
  });
});
