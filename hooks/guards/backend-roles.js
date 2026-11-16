/**
 * Guardarraíl de separación de roles para subagentes de la capa Backend.
 * Acota rutas de lectura y escritura según el rol (test-writer, developer, verifier, architect).
 */

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function isTestPath(normPath) {
  return /(?:^|\/)(?:tests?|__tests__)\/|\.(?:test|spec)\.[jt]sx?$|\/test_[^/]+\.py$|^test_[^/]+\.py$|_test\.go$|(?:^|\/)conftest\.py$/i.test(
    normPath
  );
}

function isSpecOrDocPath(normPath) {
  return /(?:^|\/)(?:openspec|docs)\/|(?:^|\/)openapi\.(?:ya?ml|json)$/i.test(normPath);
}

function isDbPath(normPath) {
  return /(?:^|\/)(?:database|supabase\/migrations|supabase\/security|prisma\/migrations|db\/migrations|migrations)\/|(?:^|\/)prisma\/schema\.prisma$/i.test(
    normPath
  );
}

function isBackendSourcePath(normPath) {
  if (isTestPath(normPath) || isSpecOrDocPath(normPath) || isDbPath(normPath)) return false;
  return /(?:^|\/)(?:backend|src|app|api|server)\//i.test(normPath);
}

/**
 * Clasifica un acceso a archivo (Read, Write, Edit) según el subagente activo.
 * @param {string|undefined} agentId
 * @param {'Read'|'Write'|'Edit'|string} toolName
 * @param {string} filePath
 * @returns {{ deny: boolean, rule?: string, reason?: string }}
 */
function classifyBackendRoleAccess(agentId, toolName, filePath) {
  if (!agentId || !filePath) return { deny: false };
  const agent = String(agentId).toLowerCase();
  const norm = normalizePath(filePath);
  const isWrite = toolName === 'Write' || toolName === 'Edit';

  if (agent.includes('backend-test-writer')) {
    if (toolName === 'Read' && isBackendSourcePath(norm)) {
      return {
        deny: true,
        rule: 'test-writer-no-impl-read',
        reason: 'Bloqueado: backend-test-writer-agent no puede leer código productivo (<backend_dir>); debe escribir tests desde specs/ y design.md.'
      };
    }
    if (isWrite && !isTestPath(norm)) {
      return {
        deny: true,
        rule: 'test-writer-only-tests',
        reason: 'Bloqueado: backend-test-writer-agent solo puede escribir o editar archivos dentro de <tests_dir>.'
      };
    }
  }

  if (agent.includes('backend-developer')) {
    if (isWrite && isTestPath(norm)) {
      return {
        deny: true,
        rule: 'developer-no-test-write',
        reason: 'Bloqueado: backend-developer-agent no puede modificar tests. Si un test contradice la spec, reporta [DISPUTA DE TEST].'
      };
    }
    if (isWrite && isDbPath(norm)) {
      return {
        deny: true,
        rule: 'developer-no-db-write',
        reason: 'Bloqueado: backend-developer-agent tiene prohibido modificar archivos de base de datos (<db_dirs>).'
      };
    }
  }

  if (agent.includes('backend-qa-agent')) {
    if (isWrite && !/(?:^|\/)openspec\/changes\/[^/]+\/verification-report\.md$/i.test(norm)) {
      return {
        deny: true,
        rule: 'verifier-only-report',
        reason: 'Bloqueado: backend-qa-agent (verificador) solo puede escribir verification-report.md; prohibido editar tests o código.'
      };
    }
  }

  if (agent.includes('api-architect-agent')) {
    if (isWrite && (isBackendSourcePath(norm) || isTestPath(norm) || isDbPath(norm))) {
      return {
        deny: true,
        rule: 'architect-no-code-or-test-write',
        reason: 'Bloqueado: api-architect-agent solo puede escribir artefactos OpenSpec y contratos OpenAPI.'
      };
    }
  }

  return { deny: false };
}

module.exports = {
  classifyBackendRoleAccess
};
