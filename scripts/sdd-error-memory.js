#!/usr/bin/env node
/**
 * Gestor determinista de memoria híbrida ante errores para ciclos SDD.
 * Multiplataforma (Linux, macOS, Windows) en Node.js nativo sin dependencias externas.
 *
 * Acciones:
 *   init     Inicializa openspec/changes/<change>/.sdd-state.json si no existe
 *   record   Registra un fallo, calcula error_signature y detecta loops (exit 2 si repite >= max_repeat)
 *   summary  Imprime resumen compacto de errores y restricciones (avoid) para reintentos
 *   promote  Promueve una regla curada a openspec/specs/<capa>/known-gotchas.md (sin duplicados)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
const opts = {
  action: '',
  changeDir: '',
  specsDir: 'openspec/specs',
  layer: '',
  step: '',
  message: '',
  cause: '',
  avoid: '',
  files: '',
  rule: '',
  context: '',
  maxRepeat: 2
};

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--action') opts.action = (args[++i] || '').toLowerCase();
  else if (a === '--change-dir') opts.changeDir = args[++i] || '';
  else if (a === '--specs-dir') opts.specsDir = args[++i] || 'openspec/specs';
  else if (a === '--layer') opts.layer = (args[++i] || '').toLowerCase();
  else if (a === '--step') opts.step = args[++i] || '';
  else if (a === '--message') opts.message = args[++i] || '';
  else if (a === '--cause') opts.cause = args[++i] || '';
  else if (a === '--avoid') opts.avoid = args[++i] || '';
  else if (a === '--files') opts.files = args[++i] || '';
  else if (a === '--rule') opts.rule = args[++i] || '';
  else if (a === '--context') opts.context = args[++i] || '';
  else if (a === '--max-repeat') opts.maxRepeat = Math.max(2, Number(args[++i] || 2) || 2);
}

function fail(msg, code = 1) {
  console.error(`ERROR: ${msg}`);
  process.exit(code);
}

function normalizeMessage(msg) {
  return String(msg || '')
    .toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}(\.\d+)?z?/g, '<ts>')
    .replace(/[a-z]:\\[^\s:'"]+/gi, '<path>')
    .replace(/\/[^\s:'"]+/g, '<path>')
    .replace(/:\d+(:\d+)?/g, ':<line>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeSignature(layer, step, message) {
  const canonical = `${layer}|${step}|${normalizeMessage(message)}`;
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}

function getStatePath(changeDir) {
  if (!changeDir) fail('Se requiere --change-dir');
  return path.resolve(changeDir, '.sdd-state.json');
}

function loadOrCreateState(statePath, layer, maxRepeat) {
  if (fs.existsSync(statePath)) {
    const data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (!Array.isArray(data.errors)) data.errors = [];
    if (!data.max_repeat) data.max_repeat = maxRepeat;
    return data;
  }
  return {
    schema_version: 1,
    layer: layer || 'unknown',
    max_repeat: maxRepeat,
    attempt: 0,
    consecutive_same_signature: 0,
    last_signature: null,
    loop_detected: false,
    promoted: false,
    errors: []
  };
}

function saveState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

if (opts.action === 'init') {
  const statePath = getStatePath(opts.changeDir);
  const state = loadOrCreateState(statePath, opts.layer, opts.maxRepeat);
  saveState(statePath, state);
  console.log(JSON.stringify({ initialized: true, path: statePath, attempt: state.attempt }));
  process.exit(0);
}

if (opts.action === 'record') {
  if (!opts.step) fail('Se requiere --step para record');
  if (!opts.message) fail('Se requiere --message para record');

  const statePath = getStatePath(opts.changeDir);
  const state = loadOrCreateState(statePath, opts.layer, opts.maxRepeat);
  const effectiveLayer = opts.layer || state.layer || 'unknown';
  const sig = computeSignature(effectiveLayer, opts.step, opts.message);

  state.attempt += 1;
  if (state.last_signature === sig) {
    state.consecutive_same_signature += 1;
  } else {
    state.consecutive_same_signature = 1;
    state.last_signature = sig;
  }

  const limit = state.max_repeat || opts.maxRepeat;
  state.loop_detected = state.consecutive_same_signature >= limit;

  state.errors.push({
    attempt: state.attempt,
    timestamp: new Date().toISOString(),
    layer: effectiveLayer,
    step: opts.step,
    error_signature: sig,
    message: opts.message,
    cause: opts.cause || undefined,
    avoid: opts.avoid || undefined,
    files: opts.files ? opts.files.split(',').map((s) => s.trim()).filter(Boolean) : undefined
  });

  saveState(statePath, state);
  const out = {
    attempt: state.attempt,
    error_signature: sig,
    consecutive_same_signature: state.consecutive_same_signature,
    loop_detected: state.loop_detected
  };
  console.log(JSON.stringify(out));
  process.exit(state.loop_detected ? 2 : 0);
}

if (opts.action === 'summary') {
  const statePath = getStatePath(opts.changeDir);
  if (!fs.existsSync(statePath)) {
    console.log(JSON.stringify({ attempt: 0, loop_detected: false, errors: [], avoid: [] }));
    process.exit(0);
  }
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const avoid = [...new Set((state.errors || []).map((e) => e.avoid).filter(Boolean))];
  const recent = (state.errors || []).slice(-3).map((e) => ({
    attempt: e.attempt,
    step: e.step,
    error_signature: e.error_signature,
    message: e.message,
    cause: e.cause
  }));
  console.log(JSON.stringify({
    layer: state.layer,
    attempt: state.attempt,
    loop_detected: Boolean(state.loop_detected),
    consecutive_same_signature: state.consecutive_same_signature || 0,
    avoid,
    recent_errors: recent
  }, null, 2));
  process.exit(0);
}

if (opts.action === 'promote') {
  if (!opts.layer) fail('Se requiere --layer para promote (db|backend|frontend)');
  if (!opts.rule) fail('Se requiere --rule para promote');

  const gotchasPath = path.resolve(opts.specsDir, opts.layer, 'known-gotchas.md');
  fs.mkdirSync(path.dirname(gotchasPath), { recursive: true });

  const header = `# Known Gotchas — ${opts.layer}\n\nReglas breves promovidas tras fallos reales del repositorio. Leer solo esta capa en \`opsx:explore\`.\n\n`;
  let content = fs.existsSync(gotchasPath) ? fs.readFileSync(gotchasPath, 'utf8') : header;
  const normalizedRule = opts.rule.trim();
  const bullet = opts.context
    ? `- ${normalizedRule} _(${opts.context.trim()})_`
    : `- ${normalizedRule}`;

  const alreadyExists = content
    .split(/\r?\n/)
    .some((line) => line.trim().toLowerCase().includes(normalizedRule.toLowerCase()));

  if (!alreadyExists) {
    if (!content.endsWith('\n')) content += '\n';
    content += `${bullet}\n`;
    fs.writeFileSync(gotchasPath, content, 'utf8');
  }

  if (opts.changeDir) {
    const statePath = getStatePath(opts.changeDir);
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      state.promoted = true;
      saveState(statePath, state);
    }
  }

  const totalRules = content.split(/\r?\n/).filter((l) => l.trim().startsWith('- ')).length;
  console.log(JSON.stringify({
    promoted: !alreadyExists,
    duplicate: alreadyExists,
    path: gotchasPath,
    total_rules: totalRules
  }));
  process.exit(0);
}

fail('Acción inválida. Usa --action <init|record|summary|promote>');
