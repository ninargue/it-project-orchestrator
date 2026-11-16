#!/usr/bin/env node
/**
 * Tests del guardarraíl contra órdenes destructivas y copias de producción.
 * Ejecutar con: node --test hooks/guards/destructive.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classifyBashCommand, classifyFileAccess } = require('./destructive.js');

const TEST_ENV = {
  DB_TEST_URL: 'postgres://postgres:test@localhost:5433/app_test',
  DB_DEV_URL: 'postgres://app:dev@localhost:5432/app_dev'
};

describe('hooks/guards/destructive.js', () => {
  const mustBlockBash = [
    ['DROP TABLE en dev', 'psql "$DB_DEV_URL" -c "DROP TABLE users;"'],
    ['DROP DATABASE sin entorno', 'psql -c "DROP DATABASE app_dev;"'],
    ['DROP SCHEMA', 'psql -c "DROP SCHEMA public CASCADE;"'],
    ['TRUNCATE TABLE', 'psql -c "TRUNCATE TABLE orders;"'],
    ['DELETE sin WHERE', 'psql -c "DELETE FROM users;"'],
    ['UPDATE sin WHERE', 'psql -c "UPDATE users SET active = false;"'],
    ['dropdb', 'dropdb app_dev'],
    ['prisma migrate reset', 'npx prisma migrate reset --force'],
    ['supabase db reset', 'supabase db reset'],
    ['rails db:drop', 'bundle exec rails db:drop'],
    ['alembic downgrade base', 'alembic downgrade base'],
    ['django flush', 'python manage.py flush --no-input'],
    ['docker volume rm', 'docker volume rm app_pgdata'],
    ['docker volume prune', 'docker volume prune -f'],
    ['docker compose down -v', 'docker compose down -v'],
    ['rm -rf pgdata', 'rm -rf ./pgdata'],
    ['cat sobre dump de prod', 'cat backups/prod_2026.dump'],
    ['pg_restore sobre dump', 'pg_restore -d "$DB_DEV_URL" prod.dump']
  ];

  for (const [label, cmd] of mustBlockBash) {
    it(`bloquea: ${label}`, () => {
      const res = classifyBashCommand(cmd, TEST_ENV);
      assert.equal(res.deny, true, `Debió bloquear: ${cmd}`);
    });
  }

  it('bloquea DROP TABLE aunque diga $DB_TEST_URL si DB_TEST_URL === DB_DEV_URL', () => {
    const sameEnv = {
      DB_TEST_URL: 'postgres://localhost:5432/app',
      DB_DEV_URL: 'postgres://localhost:5432/app'
    };
    const res = classifyBashCommand('psql "$DB_TEST_URL" -c "DROP TABLE users;"', sameEnv);
    assert.equal(res.deny, true);
  });

  const mustAllowBash = [
    ['SELECT normal', 'psql "$DB_DEV_RO_URL" -c "SELECT count(*) FROM users;"'],
    ['DELETE con WHERE', 'psql "$DB_DEV_URL" -c "DELETE FROM sessions WHERE expired_at < now();"'],
    ['UPDATE con WHERE', 'psql "$DB_DEV_URL" -c "UPDATE users SET verified = true WHERE id = 1;"'],
    ['DROP TABLE dirigido a DB_TEST_URL efímera', 'psql "$DB_TEST_URL" -c "DROP TABLE IF EXISTS items;"'],
    ['prisma reset con DB_TEST_URL sin DEV/PROD', 'DB_TEST_URL="$DB_TEST_URL" npx prisma migrate reset --force'],
    ['búsqueda con rg sobre migraciones', 'rg "DROP TABLE" database/migrations/'],
    ['docker compose down sin -v', 'docker compose down'],
    ['rm -rf sobre tmp', 'rm -rf ./tmp/build']
  ];

  for (const [label, cmd] of mustAllowBash) {
    it(`permite: ${label}`, () => {
      const res = classifyBashCommand(cmd, TEST_ENV);
      assert.equal(res.deny, false, `No debió bloquear: ${cmd} (razón: ${res.reason})`);
    });
  }

  it('classifyFileAccess bloquea dumps y backups y permite migraciones/specs', () => {
    assert.equal(classifyFileAccess('backups/2026-11-15.sql').deny, true);
    assert.equal(classifyFileAccess('tmp/prod.dump').deny, true);
    assert.equal(classifyFileAccess('C:\\repo\\db\\prod.bak').deny, true);
    assert.equal(classifyFileAccess('database/migrations/001_init.up.sql').deny, false);
    assert.equal(classifyFileAccess('openspec/changes/c1/design.md').deny, false);
  });
});
