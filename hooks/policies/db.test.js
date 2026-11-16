#!/usr/bin/env node
/**
 * Suite de pruebas para hooks/policies/db.js.
 * Ejecutar con: node --test hooks/policies/db.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classifyDbToolCall } = require('./db.js');

describe('hooks/policies/db.js', () => {
  it('db-developer-agent puede escribir migraciones y tasks.md pero NO tests', () => {
    assert.equal(classifyDbToolCall({
      agentType: 'it-project-orchestrator:db-developer-agent',
      tool: 'Write',
      filePath: 'database/migrations/001.up.sql'
    }).deny, false);

    assert.equal(classifyDbToolCall({
      agentType: 'db-developer-agent',
      tool: 'Write',
      filePath: 'database/tests/users.test.sql'
    }).deny, true);

    assert.equal(classifyDbToolCall({
      agentType: 'db-developer-agent',
      tool: 'Bash',
      command: 'psql "$DB_DEV_URL" -c "CREATE TABLE x(id int)"'
    }).deny, true);

    assert.equal(classifyDbToolCall({
      agentType: 'db-developer-agent',
      tool: 'Bash',
      command: 'openspec instructions apply --change c1 --json'
    }).deny, false);
  });

  it('db-mutation-tester tiene Edit bloqueado y solo escribe mutation-report.md', () => {
    assert.equal(classifyDbToolCall({
      agentType: 'db-mutation-tester',
      tool: 'Edit',
      filePath: 'database/tests/users.test.sql'
    }).deny, true);

    assert.equal(classifyDbToolCall({
      agentType: 'db-mutation-tester',
      tool: 'Write',
      filePath: 'openspec/changes/c1/mutation-report.md'
    }).deny, false);

    assert.equal(classifyDbToolCall({
      agentType: 'db-mutation-tester',
      tool: 'Write',
      filePath: 'database/migrations/001.up.sql'
    }).deny, true);
  });

  it('db-architect-agent puede consultar $DB_DEV_RO_URL pero no $DB_DEV_URL ni escribir SQL', () => {
    assert.equal(classifyDbToolCall({
      agentType: 'db-architect-agent',
      tool: 'Bash',
      command: 'psql "$DB_DEV_RO_URL" -c "SELECT count(*) FROM users;"'
    }).deny, false);

    assert.equal(classifyDbToolCall({
      agentType: 'db-architect-agent',
      tool: 'Bash',
      command: 'psql "$DB_DEV_URL" -c "SELECT count(*) FROM users;"'
    }).deny, true);

    assert.equal(classifyDbToolCall({
      agentType: 'db-architect-agent',
      tool: 'Write',
      filePath: 'database/migrations/001.up.sql'
    }).deny, true);
  });

  it('ignora agentes que no pertenecen a la capa db', () => {
    assert.equal(classifyDbToolCall({
      agentType: 'backend-developer-agent',
      tool: 'Write',
      filePath: 'backend/src/index.ts'
    }).deny, false);
  });
});
