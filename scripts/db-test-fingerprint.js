#!/usr/bin/env node
/**
 * Congela y verifica la huella SHA-256 de la suite de tests DB-TDD en .sdd-state.json
 * para impedir que un agente relaje o altere tests entre el ROJO y el VERDE.
 *
 * Uso:
 *   node db-test-fingerprint.js --action freeze|verify|refreeze --change-dir <dir> --tests-dir <dir> [--reason <motivo>] [--json]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
let action = '';
let changeDir = '';
let testsDir = '';
let reason = '';
let jsonOutput = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--action') action = (args[++i] || '').toLowerCase().trim();
  else if (a === '--change-dir') changeDir = args[++i] || '';
  else if (a === '--tests-dir') testsDir = args[++i] || '';
  else if (a === '--reason') reason = args[++i] || '';
  else if (a === '--json') jsonOutput = true;
}

function exitWith(code, payload) {
  if (jsonOutput) {
    console.log(JSON.stringify({ exitCode: code, action, ...payload }, null, 2));
  } else {
    const icon = code === 0 ? '✅' : '❌';
    console.log(`${icon} [DB-TEST-FINGERPRINT:${action || 'error'}] ${payload.message}`);
    if (Array.isArray(payload.changedFiles) && payload.changedFiles.length > 0) {
      for (const f of payload.changedFiles) console.log(`   - ${f}`);
    }
  }
  process.exit(code);
}

if (!['freeze', 'verify', 'refreeze'].includes(action)) {
  exitWith(3, { status: 'invalid_action', message: `Acción inválida '${action}'. Usa freeze, verify o refreeze.` });
}
if (!changeDir || !testsDir) {
  exitWith(3, { status: 'missing_args', message: 'Faltan --change-dir y/o --tests-dir.' });
}
if (!fs.existsSync(testsDir)) {
  exitWith(3, { status: 'missing_tests_dir', message: `El directorio de tests '${testsDir}' no existe.` });
}
if (action === 'refreeze' && !reason.trim()) {
  exitWith(3, { status: 'missing_reason', message: 'La acción refreeze requiere --reason "<motivo>" (ej. refuerzo pedido por db-mutation-tester).' });
}

function collectHashes(rootDir, currentDir = rootDir, out = {}) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectHashes(rootDir, full, out);
    } else if (entry.isFile()) {
      const rel = path.relative(rootDir, full).replace(/\\/g, '/');
      const normalized = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
      out[rel] = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
    }
  }
  return out;
}

const currentFiles = collectHashes(testsDir);
const fileCount = Object.keys(currentFiles).length;
if (fileCount === 0) {
  exitWith(3, { status: 'no_test_files', message: `No se encontraron archivos de test en '${testsDir}'.` });
}

const statePath = path.join(changeDir, '.sdd-state.json');
let state = {};
if (fs.existsSync(statePath)) {
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    state = {};
  }
}

if (action === 'freeze') {
  if (state.db_test_fingerprint && state.db_test_fingerprint.files) {
    exitWith(1, {
      status: 'already_frozen',
      message: 'La huella de tests ya estaba congelada. Usa --action refreeze --reason "..." si fue autorizado por mutation testing.'
    });
  }
  fs.mkdirSync(changeDir, { recursive: true });
  state.db_test_fingerprint = {
    frozenAt: new Date().toISOString(),
    testsDir: path.resolve(testsDir),
    fileCount,
    files: currentFiles,
    history: [{ event: 'freeze', at: new Date().toISOString(), fileCount }]
  };
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  exitWith(0, { status: 'frozen', fileCount, message: `Huella congelada para ${fileCount} archivo(s) de test.` });
}

if (action === 'refreeze') {
  fs.mkdirSync(changeDir, { recursive: true });
  const prevHistory = Array.isArray(state.db_test_fingerprint?.history) ? state.db_test_fingerprint.history : [];
  state.db_test_fingerprint = {
    frozenAt: new Date().toISOString(),
    testsDir: path.resolve(testsDir),
    fileCount,
    files: currentFiles,
    history: [...prevHistory, { event: 'refreeze', at: new Date().toISOString(), fileCount, reason: reason.trim() }]
  };
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  exitWith(0, { status: 'refrozen', fileCount, reason: reason.trim(), message: `Huella re-congelada (${fileCount} archivos). Motivo: ${reason.trim()}` });
}

// verify
if (!state.db_test_fingerprint || !state.db_test_fingerprint.files) {
  exitWith(1, { status: 'not_frozen', message: 'No existe huella congelada en .sdd-state.json. Ejecuta --action freeze tras el ROJO.' });
}

const frozen = state.db_test_fingerprint.files;
const changedFiles = [];

for (const [rel, hash] of Object.entries(frozen)) {
  if (!(rel in currentFiles)) changedFiles.push(`eliminado: ${rel}`);
  else if (currentFiles[rel] !== hash) changedFiles.push(`modificado: ${rel}`);
}
for (const rel of Object.keys(currentFiles)) {
  if (!(rel in frozen)) changedFiles.push(`agregado: ${rel}`);
}

if (changedFiles.length > 0) {
  exitWith(1, {
    status: 'tampered',
    changedFiles,
    message: `Se detectaron ${changedFiles.length} alteración(es) en los tests desde el congelamiento en ROJO.`
  });
}

exitWith(0, { status: 'verified', fileCount, message: `Huella verificada sin cambios (${fileCount} archivo(s) intactos).` });
