/**
 * Política de mínimo privilegio por subagente de la capa DB (rutas de escritura y comandos Bash).
 * Complementa el recorte de herramientas en agents/db/*.md y .claude/_agents/db/*.md.
 */

const DB_ROLES = new Set([
  'db-architect-agent',
  'db-qa-agent',
  'db-developer-agent',
  'db-security-agent',
  'db-mutation-tester'
]);

function normalizeDbRole(agentType) {
  if (!agentType || typeof agentType !== 'string') return null;
  const short = agentType.split(':').pop().trim();
  return DB_ROLES.has(short) ? short : null;
}

function normPath(p) {
  return String(p || '').replace(/\\/g, '/').toLowerCase();
}

function isAllowedWritePath(role, filePath) {
  const p = normPath(filePath);
  if (!p) return false;

  if (role === 'db-architect-agent') {
    return /(?:^|\/)openspec\/changes\/[^/]+\//.test(p) || /(?:^|\/)erd\.md$/.test(p);
  }
  if (role === 'db-qa-agent') {
    return /(?:^|\/)(?:tests?|__tests__|specs)\//.test(p) ||
      /\.(?:test|spec)\.[a-z0-9]+$/i.test(p) ||
      /(?:^|\/)openspec\/changes\/[^/]+\/verification-report\.md$/.test(p);
  }
  if (role === 'db-developer-agent') {
    if (/(?:^|\/)(?:tests?|__tests__)\//.test(p) || /\.(?:test|spec)\.[a-z0-9]+$/i.test(p)) return false;
    return /(?:^|\/)(?:migrations|seeds|db\/migrate)\//.test(p) ||
      /(?:^|\/)openspec\/changes\/[^/]+\/tasks\.md$/.test(p);
  }
  if (role === 'db-security-agent') {
    if (/(?:^|\/)(?:tests?|__tests__)\//.test(p) || /\.(?:test|spec)\.[a-z0-9]+$/i.test(p)) return false;
    return /(?:^|\/)(?:security|policies|migrations)\//.test(p) ||
      /(?:^|\/)openspec\/changes\/[^/]+\/tasks\.md$/.test(p);
  }
  if (role === 'db-mutation-tester') {
    return /(?:^|\/)openspec\/changes\/[^/]+\/mutation-report\.md$/.test(p);
  }
  return true;
}

function isAllowedBashCommand(role, command) {
  const cmd = String(command || '').trim();
  if (!cmd) return false;

  if (role === 'db-developer-agent' || role === 'db-security-agent') {
    return /^\s*(?:npx\s+)?openspec\b/.test(cmd);
  }

  if (role === 'db-architect-agent') {
    if (/^\s*(?:npx\s+)?openspec\b/.test(cmd)) return true;
    if (/\bDB_(?:DEV|PROD)_URL\b/.test(cmd)) return false;
    return /\b(?:DB_DEV_RO_URL|psql|mysql|sqlite3)\b/i.test(cmd) &&
      !/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i.test(cmd);
  }

  if (role === 'db-qa-agent') {
    if (/^\s*(?:npx\s+)?openspec\b/.test(cmd)) return true;
    return !/\b(?:rm|mv|chmod|chown|curl|wget)\b/i.test(cmd);
  }

  if (role === 'db-mutation-tester') {
    if (/\bDB_(?:DEV|PROD)_URL\b/.test(cmd)) return false;
    return !/\b(?:openspec\s+archive|rm|mv|chmod|chown)\b/i.test(cmd);
  }

  return true;
}

/**
 * Evalúa si un subagente DB tiene permitido usar la herramienta solicitada.
 * @param {{ agentType?: string, tool: string, filePath?: string, command?: string }} input
 * @returns {{ deny: boolean, reason?: string }}
 */
function classifyDbToolCall({ agentType, tool, filePath, command }) {
  const role = normalizeDbRole(agentType);
  if (!role) return { deny: false };

  if (role === 'db-mutation-tester' && tool === 'Edit') {
    return {
      deny: true,
      reason: 'Bloqueado: db-mutation-tester no tiene permiso Edit; solo escribe mutation-report.md.'
    };
  }

  if (tool === 'Write' || tool === 'Edit') {
    if (!isAllowedWritePath(role, filePath)) {
      return {
        deny: true,
        reason: `Bloqueado: '${role}' no puede escribir/editar fuera de sus rutas autorizadas (${filePath}).`
      };
    }
    return { deny: false };
  }

  if (tool === 'Bash') {
    if (!isAllowedBashCommand(role, command)) {
      return {
        deny: true,
        reason: `Bloqueado: comando Bash fuera de la lista permitida para '${role}'.`
      };
    }
    return { deny: false };
  }

  return { deny: false };
}

module.exports = {
  normalizeDbRole,
  classifyDbToolCall
};
