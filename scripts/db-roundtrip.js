#!/usr/bin/env node
/**
 * Gate determinista de reversibilidad real contra base de pruebas efímera (DB_TEST_URL).
 * - Modo symmetric:    snapshot(0) -> up -> snapshot(1) -> down -> snapshot(down==0) -> up -> snapshot(2==1)
 * - Modo forward-only: snapshot(0) -> up -> snapshot(1) -> up (idempotencia) -> snapshot(2==1)
 *
 * Multiplataforma (Node.js nativo, sin dependencias externas).
 */

const crypto = require('crypto');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
let mode = 'symmetric';
let upCmd = '';
let downCmd = '';
let snapshotCmd = '';
let testUrl = process.env.DB_TEST_URL || '';
let devUrl = process.env.DB_DEV_URL || '';
let jsonOutput = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--mode') mode = (args[++i] || '').toLowerCase().trim();
  else if (a === '--up-cmd') upCmd = args[++i] || '';
  else if (a === '--down-cmd') downCmd = args[++i] || '';
  else if (a === '--snapshot-cmd') snapshotCmd = args[++i] || '';
  else if (a === '--test-url') testUrl = args[++i] || '';
  else if (a === '--dev-url') devUrl = args[++i] || '';
  else if (a === '--json') jsonOutput = true;
}

function finish(code, status, detail = {}) {
  if (jsonOutput) {
    console.log(JSON.stringify({ status, exitCode: code, mode, ...detail }, null, 2));
  } else {
    const icon = code === 0 ? '✅' : code === 2 ? '🛑' : '❌';
    console.log(`${icon} [DB-ROUNDTRIP:${mode}] ${detail.message || status}`);
    if (detail.diff) console.error(detail.diff);
  }
  process.exit(code);
}

if (!['symmetric', 'forward-only'].includes(mode)) {
  finish(3, 'invalid_args', { message: `Modo inválido '${mode}'. Usa 'symmetric' o 'forward-only'.` });
}

if (!upCmd || !snapshotCmd || (mode === 'symmetric' && !downCmd)) {
  finish(3, 'missing_args', {
    message: 'Faltan flags obligatorios: --up-cmd, --snapshot-cmd' + (mode === 'symmetric' ? ' y --down-cmd' : '')
  });
}

if (testUrl && devUrl && testUrl.trim() === devUrl.trim()) {
  finish(2, 'unsafe_environment', {
    message: 'DB_TEST_URL coincide con DB_DEV_URL. Abortando roundtrip para proteger la base de desarrollo.'
  });
}

function normalizeSnapshot(raw) {
  return String(raw || '').replace(/\r\n/g, '\n').trim();
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function runCmd(label, cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    finish(1, 'command_failed', {
      step: label,
      message: `Falló '${label}' (${cmd}): ${msg}`
    });
  }
}

const snap0 = normalizeSnapshot(runCmd('snapshot_initial', snapshotCmd));
const hash0 = sha256(snap0);

runCmd('up_1', upCmd);
const snap1 = normalizeSnapshot(runCmd('snapshot_after_up_1', snapshotCmd));
const hash1 = sha256(snap1);

if (mode === 'symmetric') {
  runCmd('down', downCmd);
  const snapDown = normalizeSnapshot(runCmd('snapshot_after_down', snapshotCmd));
  const hashDown = sha256(snapDown);

  if (hashDown !== hash0) {
    finish(1, 'down_drift', {
      message: 'El esquema tras ejecutar DOWN no coincide con el esquema inicial (ROUNDTRIP DOWN DRIFT).',
      hashInitial: hash0,
      hashAfterDown: hashDown,
      diff: `--- inicial ---\n${snap0}\n--- tras down ---\n${snapDown}`
    });
  }

  runCmd('up_2', upCmd);
  const snap2 = normalizeSnapshot(runCmd('snapshot_after_up_2', snapshotCmd));
  const hash2 = sha256(snap2);

  if (hash2 !== hash1) {
    finish(1, 'up_drift', {
      message: 'El segundo UP produjo un esquema distinto al primer UP (ROUNDTRIP UP DRIFT).',
      hashFirstUp: hash1,
      hashSecondUp: hash2
    });
  }

  finish(0, 'passed', {
    message: 'Ciclo completo up → down → up verificado con 0 deriva de esquema.',
    hashInitial: hash0,
    hashAfterUp: hash1,
    hashAfterDown: hashDown,
    hashSecondUp: hash2
  });
} else {
  // forward-only: verificar idempotencia ejecutando up por segunda vez
  runCmd('up_idempotent_check', upCmd);
  const snap2 = normalizeSnapshot(runCmd('snapshot_after_up_2', snapshotCmd));
  const hash2 = sha256(snap2);

  if (hash2 !== hash1) {
    finish(1, 'not_idempotent', {
      message: 'La migración forward-only no es idempotente: el segundo UP alteró el esquema.',
      hashFirstUp: hash1,
      hashSecondUp: hash2
    });
  }

  finish(0, 'passed', {
    message: 'Migración forward-only idempotente verificada (up × 2 sin deriva).',
    hashInitial: hash0,
    hashAfterUp: hash1,
    hashSecondUp: hash2
  });
}
