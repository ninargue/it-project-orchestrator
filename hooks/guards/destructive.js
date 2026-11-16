/**
 * Guardarraíl contra órdenes destructivas de base de datos, volúmenes y copias de producción.
 *
 * === LO QUE ESTE HOOK NO VE (LÍMITES CONOCIDOS) ===
 * 1. Sentencias SQL dentro de archivos ejecutados por referencia (`psql -f script.sql`, `mysql < file.sql`,
 *    runners de migración o scripts Node/Python).
 * 2. Alias de shell, funciones definidas en la sesión o scripts envolventes que oculten la orden real.
 * 3. Llamadas directas a herramientas MCP de base de datos o clientes gráficos fuera de Bash/Read.
 * 4. Entornos donde no corren los hooks de Claude Code (p. ej. Antigravity).
 *
 * Por esto, la defensa primaria sigue siendo el rol de solo lectura (`agent_ro` con
 * `default_transaction_read_only = on`) y la separación `DB_TEST_URL != DB_DEV_URL`.
 * Este hook actúa como segunda capa determinista de defensa en profundidad.
 */

const BACKUP_FILE_REGEX = /(?:^|[\\/\s"'])(?:[^\s"']*\.(?:dump|bak|pgdump|sql\.gz|backup)|(?:backups|pg_backups|db_backups)[\\/][^\s"']+)/i;
const READ_OR_RESTORE_CMD_REGEX = /\b(?:cat|head|tail|less|more|strings|pg_restore|gunzip|zcat|psql|mysql)\b/i;

const SAFE_INSPECTION_PREFIX_REGEX = /^\s*(?:rg|grep|git\s+(?:log|diff|show|status)|node\s+--test)\b/i;

const DESTRUCTIVE_CLI_RULES = [
  { id: 'dropdb', regex: /\bdropdb\b/i, label: 'dropdb' },
  { id: 'prisma-reset', regex: /\bprisma\s+migrate\s+reset\b/i, label: 'prisma migrate reset' },
  { id: 'supabase-reset', regex: /\bsupabase\s+db\s+reset\b/i, label: 'supabase db reset' },
  { id: 'rails-db-drop', regex: /\b(?:rails|rake)\s+db:(?:drop|reset)\b/i, label: 'rails/rake db:drop|reset' },
  { id: 'alembic-base', regex: /\balembic\s+downgrade\s+base\b/i, label: 'alembic downgrade base' },
  { id: 'django-flush', regex: /\bmanage\.py\s+flush\b/i, label: 'manage.py flush' },
  { id: 'docker-volume', regex: /\bdocker\s+volume\s+(?:rm|prune)\b/i, label: 'docker volume rm/prune' },
  { id: 'docker-compose-v', regex: /\bdocker[\s-]+compose\s+down\b[^\n]*(?:\s-v\b|\s--volumes\b)/i, label: 'docker compose down -v' }
];

const DESTRUCTIVE_SQL_RULES = [
  { id: 'drop-sql', regex: /\bDROP\s+(?:TABLE|SCHEMA|DATABASE)\b/i, label: 'DROP TABLE/SCHEMA/DATABASE' },
  { id: 'truncate-sql', regex: /\bTRUNCATE\s+(?:TABLE\s+)?[a-zA-Z0-9_."`\[\]]+/i, label: 'TRUNCATE' },
  { id: 'delete-no-where', regex: /\bDELETE\s+FROM\s+[a-zA-Z0-9_."`\[\]]+\s*(?:;|$|["'])/i, label: 'DELETE FROM sin WHERE' },
  { id: 'update-no-where', regex: /\bUPDATE\s+[a-zA-Z0-9_."`\[\]]+\s+SET\s+(?:(?!\bWHERE\b)[^;])+(?:;|$|["'])/i, label: 'UPDATE sin WHERE' }
];

const DEFAULT_DATA_DIRS = ['pgdata', 'postgres_data', 'mysql_data', 'db_data', 'volumes'];

function targetsOnlyTestDb(command, env = {}) {
  const testUrl = (env.DB_TEST_URL || '').trim();
  const devUrl = (env.DB_DEV_URL || '').trim();
  const prodUrl = (env.DB_PROD_URL || '').trim();

  if (/\bDB_(?:DEV|PROD)_URL\b|\bDATABASE_URL\b/.test(command)) return false;
  if (devUrl && command.includes(devUrl)) return false;
  if (prodUrl && command.includes(prodUrl)) return false;
  if (testUrl && devUrl && testUrl === devUrl) return false;

  if (/\$DB_TEST_URL\b|\$\{DB_TEST_URL\}|%DB_TEST_URL%/i.test(command)) return true;
  if (testUrl && command.includes(testUrl)) return true;
  return false;
}

/**
 * Clasifica un comando Bash para determinar si debe bloquearse.
 * @param {string} command
 * @param {Record<string, string|undefined>} [env]
 * @param {{ dataDirs?: string[], backupDirs?: string[] }} [options]
 * @returns {{ deny: boolean, rule?: string, reason?: string }}
 */
function classifyBashCommand(command, env = process.env, options = {}) {
  if (!command || typeof command !== 'string') return { deny: false };
  const cmd = command.trim();

  // 1. Acceso a copias de producción (*.dump, *.bak, backups/)
  if (BACKUP_FILE_REGEX.test(cmd) && READ_OR_RESTORE_CMD_REGEX.test(cmd)) {
    return {
      deny: true,
      rule: 'prod-backup-access',
      reason: 'Bloqueado: el agente no puede leer, restaurar ni inspeccionar copias de producción (*.dump, *.bak, backups/).'
    };
  }

  if (Array.isArray(options.backupDirs)) {
    for (const dir of options.backupDirs) {
      if (dir && cmd.includes(dir) && READ_OR_RESTORE_CMD_REGEX.test(cmd)) {
        return {
          deny: true,
          rule: 'prod-backup-dir',
          reason: `Bloqueado: acceso a directorio de backups '${dir}' prohibido para el agente.`
        };
      }
    }
  }

  // 2. No bloquear herramientas de búsqueda de texto / tests
  if (SAFE_INSPECTION_PREFIX_REGEX.test(cmd)) {
    return { deny: false };
  }

  // 3. Borrado de directorios de datos / volúmenes en filesystem
  const dataDirs = [...DEFAULT_DATA_DIRS, ...(options.dataDirs || [])];
  const isRmForce = /\brm\s+-[^\n]*r[^\n]*f\b|\brm\s+-[^\n]*f[^\n]*r\b|\bRemove-Item\b[^\n]*-Recurse/i.test(cmd);
  if (isRmForce) {
    for (const dir of dataDirs) {
      const escaped = dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?:^|[\\\\/\\s"'])${escaped}(?:$|[\\\\/\\s"'])`, 'i').test(cmd)) {
        return {
          deny: true,
          rule: 'rm-data-dir',
          reason: `Bloqueado: borrado recursivo sobre directorio de datos '${dir}'.`
        };
      }
    }
  }

  // Si apunta exclusivamente a la base de pruebas efímera ($DB_TEST_URL != $DB_DEV_URL), permitir DDL/reset
  const isTestOnly = targetsOnlyTestDb(cmd, env);

  // 4. CLIs destructivos
  for (const rule of DESTRUCTIVE_CLI_RULES) {
    if (rule.regex.test(cmd)) {
      if (isTestOnly && !rule.id.startsWith('docker')) {
        return { deny: false };
      }
      return {
        deny: true,
        rule: rule.id,
        reason: `Bloqueado: comando destructivo '${rule.label}' denegado fuera de la base de pruebas efímera.`
      };
    }
  }

  // 5. SQL destructivo
  if (!isTestOnly) {
    for (const rule of DESTRUCTIVE_SQL_RULES) {
      if (rule.regex.test(cmd)) {
        return {
          deny: true,
          rule: rule.id,
          reason: `Bloqueado: sentencia destructiva '${rule.label}' denegada (usa DB_TEST_URL efímera para resets o agrega WHERE).`
        };
      }
    }
  }

  return { deny: false };
}

/**
 * Clasifica accesos a archivos (Read/Edit/Write) para bloquear copias de producción.
 * @param {string} filePath
 * @param {{ backupDirs?: string[] }} [options]
 * @returns {{ deny: boolean, rule?: string, reason?: string }}
 */
function classifyFileAccess(filePath, options = {}) {
  if (!filePath || typeof filePath !== 'string') return { deny: false };
  const normalized = filePath.replace(/\\/g, '/');

  if (/\.(?:dump|bak|pgdump|sql\.gz|backup)$/i.test(normalized) || /(?:^|\/)(?:backups|pg_backups|db_backups)(?:\/|$)/i.test(normalized)) {
    return {
      deny: true,
      rule: 'prod-backup-file',
      reason: 'Bloqueado: el agente no puede leer ni editar archivos de respaldo o copias de producción.'
    };
  }

  if (Array.isArray(options.backupDirs)) {
    for (const dir of options.backupDirs) {
      const normDir = String(dir).replace(/\\/g, '/').replace(/\/+$/, '');
      if (normDir && (normalized === normDir || normalized.startsWith(`${normDir}/`))) {
        return {
          deny: true,
          rule: 'prod-backup-dir',
          reason: `Bloqueado: acceso prohibido al directorio de respaldos '${dir}'.`
        };
      }
    }
  }

  return { deny: false };
}

module.exports = {
  classifyBashCommand,
  classifyFileAccess
};
