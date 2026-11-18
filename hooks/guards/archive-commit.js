'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Guardarraíl determinista para cierre SDD (openspec archive / bulk-archive y git commit).
 *
 * Previene:
 * 1. Encadenar validación/tests con `openspec archive` o `git commit` en un solo comando Bash.
 * 2. Encadenar `openspec archive` / `openspec bulk-archive` con `git commit` en un solo comando.
 * 3. Archivar un cambio sin `verification-report.md` `[APROBADO]`, con tareas `- [ ]` pendientes,
 *    o con `mutation-report.md` en estado `[TESTS COMPLACIENTES DETECTADOS]`.
 * 4. Hacer `git commit` mientras exista un cambio activo con reporte observado o tests complacientes.
 */

const OPENSPEC_ARCHIVE_REGEX = /\bopenspec\s+(?:bulk-)?archive\b(?:\s+["']?([a-zA-Z0-9._-]+)["']?)?/i;
const GIT_COMMIT_REGEX = /\bgit\s+commit\b/i;
const CHAIN_SEPARATOR_REGEX = /(?:&&|\|\||;|\r?\n)/;
const VERIFY_OR_TEST_REGEX = /\b(?:db-verify-gate\.js|validate-db-migrations\.js|validate-backend\.js|validate-frontend\.js|openspec\s+validate|node\s+--test|npm\s+test|pnpm\s+test|yarn\s+test|pytest|vitest|jest|psql|mysql)\b/i;

function isHelpOrDryCommand(cmd) {
  return /(?:^|\s)(?:--help|-h|--version)(?:\s|$)/i.test(cmd);
}

function validateChangeDirForArchive(changeDir, changeName) {
  if (!fs.existsSync(changeDir) || !fs.statSync(changeDir).isDirectory()) {
    return { deny: false };
  }

  const verifyPath = path.join(changeDir, 'verification-report.md');
  if (!fs.existsSync(verifyPath)) {
    return {
      deny: true,
      rule: 'archive-missing-verification-report',
      reason: `Bloqueado: falta verification-report.md en openspec/changes/${changeName}/. Ejecuta opsx:verify, presenta el reporte al usuario y espera confirmación (🛑) antes de archivar.`
    };
  }

  const verifyContent = fs.readFileSync(verifyPath, 'utf8');
  if (!/\[APROBADO\]/i.test(verifyContent) || /\[OBSERVADO[^\]]*\]/i.test(verifyContent)) {
    return {
      deny: true,
      rule: 'archive-requires-approved-verify',
      reason: `Bloqueado: verification-report.md en openspec/changes/${changeName}/ no tiene veredicto [APROBADO]. Resuelve los hallazgos y vuelve a verificar antes de archivar.`
    };
  }

  const mutationPath = path.join(changeDir, 'mutation-report.md');
  if (fs.existsSync(mutationPath)) {
    const mutationContent = fs.readFileSync(mutationPath, 'utf8');
    if (/\[TESTS COMPLACIENTES DETECTADOS\]/i.test(mutationContent)) {
      return {
        deny: true,
        rule: 'archive-blocked-by-mutation-report',
        reason: `Bloqueado: mutation-report.md en openspec/changes/${changeName}/ reporta [TESTS COMPLACIENTES DETECTADOS]. Refuerza los tests antes de archivar.`
      };
    }
  }

  const tasksPath = path.join(changeDir, 'tasks.md');
  if (fs.existsSync(tasksPath)) {
    const tasksContent = fs.readFileSync(tasksPath, 'utf8');
    if (/^\s*[-*]\s+\[\s\]/m.test(tasksContent)) {
      return {
        deny: true,
        rule: 'archive-incomplete-tasks',
        reason: `Bloqueado: tasks.md en openspec/changes/${changeName}/ aún tiene tareas pendientes (- [ ]).`
      };
    }
  }

  return { deny: false };
}

function checkActiveChangesBeforeCommit(cwd) {
  const changesRoot = path.join(cwd, 'openspec', 'changes');
  if (!fs.existsSync(changesRoot) || !fs.statSync(changesRoot).isDirectory()) {
    return { deny: false };
  }

  const entries = fs.readdirSync(changesRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'archive') continue;
    const changeDir = path.join(changesRoot, entry.name);

    const verifyPath = path.join(changeDir, 'verification-report.md');
    if (fs.existsSync(verifyPath)) {
      const content = fs.readFileSync(verifyPath, 'utf8');
      if (/\[OBSERVADO[^\]]*\]/i.test(content)) {
        return {
          deny: true,
          rule: 'commit-blocked-by-observed-verify',
          reason: `Bloqueado: openspec/changes/${entry.name}/verification-report.md está [OBSERVADO]. No se puede hacer commit hasta aprobar opsx:verify.`
        };
      }
    }

    const mutationPath = path.join(changeDir, 'mutation-report.md');
    if (fs.existsSync(mutationPath)) {
      const content = fs.readFileSync(mutationPath, 'utf8');
      if (/\[TESTS COMPLACIENTES DETECTADOS\]/i.test(content)) {
        return {
          deny: true,
          rule: 'commit-blocked-by-mutation-report',
          reason: `Bloqueado: openspec/changes/${entry.name}/mutation-report.md reporta [TESTS COMPLACIENTES DETECTADOS].`
        };
      }
    }
  }

  return { deny: false };
}

/**
 * Clasifica un comando Bash de cierre SDD (archive / commit).
 * @param {string} command
 * @param {{ cwd?: string }} [options]
 * @returns {{ deny: boolean, rule?: string, reason?: string }}
 */
function classifyArchiveOrCommitCommand(command, options = {}) {
  if (!command || typeof command !== 'string') return { deny: false };
  const cmd = command.trim();
  if (!cmd || isHelpOrDryCommand(cmd)) return { deny: false };

  const archiveMatch = cmd.match(OPENSPEC_ARCHIVE_REGEX);
  const hasArchive = Boolean(archiveMatch);
  const hasCommit = GIT_COMMIT_REGEX.test(cmd);

  if (!hasArchive && !hasCommit) {
    return { deny: false };
  }

  if (hasArchive && hasCommit) {
    return {
      deny: true,
      rule: 'no-chained-archive-commit',
      reason: 'Bloqueado: prohibido encadenar openspec archive/bulk-archive y git commit en un mismo comando. Pide confirmación explícita del usuario y ejecuta primero archive y luego commit.'
    };
  }

  if (CHAIN_SEPARATOR_REGEX.test(cmd) && VERIFY_OR_TEST_REGEX.test(cmd)) {
    return {
      deny: true,
      rule: 'no-chained-verify-archive-commit',
      reason: 'Bloqueado: prohibido encadenar validaciones o tests con openspec archive o git commit en un mismo comando. Presenta primero el reporte al usuario y espera confirmación explícita (🛑 FIN DE TURNO OBLIGATORIO).'
    };
  }

  const cwd = options.cwd || process.cwd();

  if (hasArchive) {
    const changeName = archiveMatch[1];
    if (changeName && !changeName.startsWith('-')) {
      const changeDir = path.join(cwd, 'openspec', 'changes', changeName);
      const check = validateChangeDirForArchive(changeDir, changeName);
      if (check.deny) return check;
    }
  }

  if (hasCommit) {
    const commitCheck = checkActiveChangesBeforeCommit(cwd);
    if (commitCheck.deny) return commitCheck;
  }

  return { deny: false };
}

module.exports = {
  classifyArchiveOrCommitCommand
};
