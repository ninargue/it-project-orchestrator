#!/usr/bin/env node
/**
 * Pruebas unitarias deterministas para hooks/guards/backend-roles.js.
 * Ejecutar con: node --test hooks/guards/backend-roles.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classifyBackendRoleAccess } = require('./backend-roles.js');

describe('backend-roles.js', () => {
  it('bloquea a backend-test-writer-agent leer código productivo y escribir fuera de tests', () => {
    const readCode = classifyBackendRoleAccess('backend-test-writer-agent', 'Read', 'backend/services/sales.ts');
    assert.equal(readCode.deny, true);
    assert.equal(readCode.rule, 'test-writer-no-impl-read');

    const readSpec = classifyBackendRoleAccess('backend-test-writer-agent', 'Read', 'openspec/changes/0001-ventas/specs/ventas/spec.md');
    assert.equal(readSpec.deny, false);

    const readTest = classifyBackendRoleAccess('backend-test-writer-agent', 'Read', 'backend/tests/sales.test.ts');
    assert.equal(readTest.deny, false);

    const writeCode = classifyBackendRoleAccess('backend-test-writer-agent', 'Write', 'backend/services/sales.ts');
    assert.equal(writeCode.deny, true);
    assert.equal(writeCode.rule, 'test-writer-only-tests');

    const writeTest = classifyBackendRoleAccess('backend-test-writer-agent', 'Write', 'tests/sales.test.ts');
    assert.equal(writeTest.deny, false);
  });

  it('bloquea a backend-developer-agent modificar tests o archivos de BD', () => {
    const editTest = classifyBackendRoleAccess('backend-developer-agent', 'Edit', 'tests/api/test_sales.py');
    assert.equal(editTest.deny, true);
    assert.equal(editTest.rule, 'developer-no-test-write');

    const writeDb = classifyBackendRoleAccess('backend-developer-agent', 'Write', 'supabase/migrations/001.sql');
    assert.equal(writeDb.deny, true);
    assert.equal(writeDb.rule, 'developer-no-db-write');

    const writeCode = classifyBackendRoleAccess('backend-developer-agent', 'Write', 'src/services/sales.ts');
    assert.equal(writeCode.deny, false);
  });

  it('limita a backend-qa-agent a escribir únicamente verification-report.md', () => {
    const editTest = classifyBackendRoleAccess('backend-qa-agent', 'Edit', 'tests/sales.test.ts');
    assert.equal(editTest.deny, true);

    const writeReport = classifyBackendRoleAccess(
      'backend-qa-agent',
      'Write',
      'openspec\\changes\\0001-ventas\\verification-report.md'
    );
    assert.equal(writeReport.deny, false);
  });

  it('bloquea a api-architect-agent escribir código productivo o tests', () => {
    const writeCode = classifyBackendRoleAccess('api-architect-agent', 'Write', 'backend/routers/sales.py');
    assert.equal(writeCode.deny, true);

    const writeOpenApi = classifyBackendRoleAccess('api-architect-agent', 'Write', 'openapi.yaml');
    assert.equal(writeOpenApi.deny, false);
  });
});
