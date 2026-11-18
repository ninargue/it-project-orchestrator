#!/usr/bin/env node
/**
 * Gestor determinista de memoria híbrida ante errores para ciclos SDD.
 * Multiplataforma (Linux, macOS, Windows) en Node.js nativo sin dependencias externas.
 *
 * Acciones:
 *   init            Inicializa openspec/changes/<change>/.sdd-state.json si no existe
 *   record          Registra un fallo, calcula error_signature y detecta loops (exit 2 si repite >= max_repeat)
 *   summary         Imprime resumen compacto de errores y restricciones (avoid) para reintentos
 *   promote         Promueve una regla curada a openspec/specs/<capa>/known-gotchas.md (sin duplicados)
 *   dispatch        Registra un despacho de subagente pendiente y su artefacto esperado (timeout default 180s)
 *   verify-handoff  Verifica en disco el artefacto esperado tras respuesta/watchdog y limpia el despacho si es válido
 *   pending         Lista despachos pendientes en .sdd-state.json (útil tras watchdog o reinicio de servidor)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VALID_LAYERS = new Set(['db', 'backend', 'frontend']);
const MAX_RULE_LENGTH = 240;
const SOFT_MAX_RULES = 25;

function fail(msg, code = 1) {
  console.error(`ERROR: ${msg}`);
  process.exit(code);
}

const args = process.argv.slice(2);
const opts = {
  action: '',
  changeDir: '',
  specsDir: path.join('openspec', 'specs'),
  layer: '',
  step: '',
  message: '',
  cause: '',
  avoid: '',
  files: '',
  rule: '',
  context: '',
  maxRepeat: 2,
  agent: '',
  conversationId: '',
  expectedArtifact: '',
  expectedMarkers: '',
  timeoutSeconds: 180
};

function nextArgValue(flag, index) {
  const val = args[index + 1];
  if (val === undefined || val.startsWith('--')) {
    fail(`Falta el valor requerido para ${flag}`);
  }
  return val;
}

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--action') { opts.action = nextArgValue(a, i).toLowerCase(); i++; }
  else if (a === '--change-dir') { opts.changeDir = nextArgValue(a, i); i++; }
  else if (a === '--specs-dir') { opts.specsDir = nextArgValue(a, i); i++; }
  else if (a === '--layer') { opts.layer = nextArgValue(a, i).toLowerCase(); i++; }
  else if (a === '--step') { opts.step = nextArgValue(a, i); i++; }
  else if (a === '--message') { opts.message = nextArgValue(a, i); i++; }
  else if (a === '--cause') { opts.cause = nextArgValue(a, i); i++; }
  else if (a === '--avoid') { opts.avoid = nextArgValue(a, i); i++; }
  else if (a === '--files') { opts.files = nextArgValue(a, i); i++; }
  else if (a === '--rule') { opts.rule = nextArgValue(a, i); i++; }
  else if (a === '--context') { opts.context = nextArgValue(a, i); i++; }
  else if (a === '--agent') { opts.agent = nextArgValue(a, i); i++; }
  else if (a === '--conversation-id') { opts.conversationId = nextArgValue(a, i); i++; }
  else if (a === '--expected-artifact') { opts.expectedArtifact = nextArgValue(a, i); i++; }
  else if (a === '--expected-markers') { opts.expectedMarkers = nextArgValue(a, i); i++; }
  else if (a === '--timeout-seconds') {
    const raw = Number(nextArgValue(a, i));
    i++;
    opts.timeoutSeconds = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 180;
  }
  else if (a === '--max-repeat') {
    const raw = Number(nextArgValue(a, i));
    i++;
    opts.maxRepeat = Math.max(2, Number.isFinite(raw) ? raw : 2);
  }
}

if (opts.layer && !VALID_LAYERS.has(opts.layer)) {
  fail(`Capa inválida '${opts.layer}'. Valores permitidos: db, backend, frontend`);
}

function normalizeMessage(msg) {
  return String(msg || '')
    .toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}(\.\d+)?z?/g, '<ts>')
    .replace(/\bfile:\/\/\/?/g, '')
    .replace(/\(\d+,\s*\d+\)/g, ':<line>')
    .replace(/:(\d+)(?::\d+)?\b/g, ':<line>')
    .replace(/\\\\\?\\[a-z]:[\\/][^\s:'"()<>]+/gi, '<path>')
    .replace(/\\\\[^\s:'"()<>]+/g, '<path>')
    .replace(/[a-z]:[\\/][^\s:'"()<>]+/gi, '<path>')
    .replace(/(?:\/|[a-z0-9_.-]+[\\/])[^\s:'"()<>]+/gi, '<path>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeSignature(layer, step, message) {
  const canonical = `${layer}|${step.trim().toLowerCase()}|${normalizeMessage(message)}`;
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}

function getStatePath(changeDir) {
  if (!changeDir) fail('Se requiere --change-dir');
  return path.resolve(changeDir, '.sdd-state.json');
}

function readStateSafe(statePath) {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (err) {
    fail(`El archivo de estado '${statePath}' está corrupto o no es JSON válido: ${err.message}`);
  }
}

function loadOrCreateState(statePath, layer, maxRepeat) {
  if (fs.existsSync(statePath)) {
    const data = readStateSafe(statePath);
    if (!Array.isArray(data.errors)) data.errors = [];
    if (!Array.isArray(data.pending_dispatches)) data.pending_dispatches = [];
    if (!data.max_repeat) data.max_repeat = maxRepeat;
    if (layer && (!data.layer || data.layer === 'unknown')) data.layer = layer;
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
    errors: [],
    pending_dispatches: []
  };
}

function saveState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function extractCanonicalRuleFromBullet(line) {
  return line
    .trim()
    .replace(/^-\s+/, '')
    .replace(/\s+_\([^)]+\)_$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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
  state.layer = effectiveLayer;
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
    files: opts.files ? opts.files.split(',').map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean) : undefined
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
  const state = readStateSafe(statePath);
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

  const normalizedRule = opts.rule.replace(/\s+/g, ' ').trim();
  if (!normalizedRule) fail('El valor de --rule no puede estar vacío');
  if (normalizedRule.length > MAX_RULE_LENGTH) {
    fail(`La regla excede el máximo de ${MAX_RULE_LENGTH} caracteres (${normalizedRule.length})`);
  }

  const normalizedContext = opts.context ? opts.context.replace(/\s+/g, ' ').trim() : '';
  const gotchasPath = path.resolve(opts.specsDir, opts.layer, 'known-gotchas.md');
  fs.mkdirSync(path.dirname(gotchasPath), { recursive: true });

  const header = `# Known Gotchas — ${opts.layer}\n\nReglas breves promovidas tras fallos reales del repositorio. Leer solo esta capa en \`opsx:explore\`.\n\n`;
  let content = fs.existsSync(gotchasPath) ? fs.readFileSync(gotchasPath, 'utf8') : header;
  const bullet = normalizedContext
    ? `- ${normalizedRule} _(${normalizedContext})_`
    : `- ${normalizedRule}`;

  const existingBulletLines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('- '));

  const alreadyExists = existingBulletLines
    .some((line) => extractCanonicalRuleFromBullet(line) === normalizedRule.toLowerCase());

  if (!alreadyExists) {
    if (!content.endsWith('\n')) content += '\n';
    content += `${bullet}\n`;
    fs.writeFileSync(gotchasPath, content, 'utf8');
  }

  if (opts.changeDir) {
    const statePath = getStatePath(opts.changeDir);
    if (fs.existsSync(statePath)) {
      const state = readStateSafe(statePath);
      state.promoted = true;
      saveState(statePath, state);
    }
  }

  const totalRules = content.split(/\r?\n/).filter((l) => l.trim().startsWith('- ')).length;
  const result = {
    promoted: !alreadyExists,
    duplicate: alreadyExists,
    path: gotchasPath,
    total_rules: totalRules
  };
  if (totalRules > SOFT_MAX_RULES) {
    result.warning = `known-gotchas.md tiene ${totalRules} reglas (umbral recomendado: ${SOFT_MAX_RULES}). Considera consolidar reglas antiguas.`;
  }
  console.log(JSON.stringify(result));
  process.exit(0);
}

if (opts.action === 'dispatch') {
  if (!opts.agent) fail('Se requiere --agent para dispatch');
  if (!opts.step) fail('Se requiere --step para dispatch');
  if (!opts.expectedArtifact) fail('Se requiere --expected-artifact para dispatch');

  const statePath = getStatePath(opts.changeDir);
  const state = loadOrCreateState(statePath, opts.layer, opts.maxRepeat);
  const markers = opts.expectedMarkers
    ? opts.expectedMarkers.split(',').map((m) => m.trim()).filter(Boolean)
    : [];

  const idx = state.pending_dispatches.findIndex(
    (d) => d.agent === opts.agent && d.step === opts.step
  );
  const prevAttempt = idx >= 0 ? (state.pending_dispatches[idx].attempt || 1) : 0;
  const entry = {
    agent: opts.agent,
    step: opts.step,
    conversation_id: opts.conversationId || undefined,
    expected_artifact: opts.expectedArtifact,
    expected_markers: markers,
    timeout_seconds: opts.timeoutSeconds,
    started_at: new Date().toISOString(),
    attempt: prevAttempt + 1
  };
  if (idx >= 0) state.pending_dispatches[idx] = entry;
  else state.pending_dispatches.push(entry);

  saveState(statePath, state);
  console.log(JSON.stringify({
    ok: true,
    action: 'dispatch',
    agent: entry.agent,
    step: entry.step,
    attempt: entry.attempt,
    timeout_seconds: entry.timeout_seconds,
    expected_artifact: entry.expected_artifact
  }));
  process.exit(0);
}

if (opts.action === 'verify-handoff') {
  if (!opts.agent) fail('Se requiere --agent para verify-handoff');
  if (!opts.step) fail('Se requiere --step para verify-handoff');

  const statePath = getStatePath(opts.changeDir);
  const state = loadOrCreateState(statePath, opts.layer, opts.maxRepeat);
  const idx = state.pending_dispatches.findIndex(
    (d) => d.agent === opts.agent && d.step === opts.step
  );
  const pending = idx >= 0 ? state.pending_dispatches[idx] : null;
  const expectedArtifact = opts.expectedArtifact || (pending && pending.expected_artifact) || '';
  if (!expectedArtifact) fail('Se requiere --expected-artifact (o un dispatch previo) para verify-handoff');

  const markers = opts.expectedMarkers
    ? opts.expectedMarkers.split(',').map((m) => m.trim()).filter(Boolean)
    : (pending && Array.isArray(pending.expected_markers) ? pending.expected_markers : []);
  const attempt = (pending && pending.attempt) || 1;
  const artifactPath = path.isAbsolute(expectedArtifact)
    ? expectedArtifact
    : path.resolve(opts.changeDir, expectedArtifact);

  const failHandoff = (reason) => {
    console.log(JSON.stringify({
      ok: false,
      status: 'incomplete_handoff',
      reason,
      agent: opts.agent,
      step: opts.step,
      expected_artifact: expectedArtifact,
      attempt,
      retry_allowed: attempt < 2
    }));
    process.exit(1);
  };

  if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
    failHandoff('missing_file');
  }
  const content = fs.readFileSync(artifactPath, 'utf8');
  if (!content.trim()) {
    failHandoff('empty_file');
  }
  if (markers.length > 0 && !markers.some((m) => content.includes(m))) {
    failHandoff('missing_marker');
  }

  if (idx >= 0) {
    state.pending_dispatches.splice(idx, 1);
    saveState(statePath, state);
  }
  console.log(JSON.stringify({
    ok: true,
    status: 'verified',
    agent: opts.agent,
    step: opts.step,
    expected_artifact: expectedArtifact,
    attempt
  }));
  process.exit(0);
}

if (opts.action === 'pending') {
  const statePath = getStatePath(opts.changeDir);
  if (!fs.existsSync(statePath)) {
    console.log(JSON.stringify({ count: 0, pending: [] }));
    process.exit(0);
  }
  const state = readStateSafe(statePath);
  const now = Date.now();
  const pending = (state.pending_dispatches || []).map((d) => {
    const startedMs = Date.parse(d.started_at || '');
    const elapsedSeconds = Number.isFinite(startedMs) ? Math.max(0, Math.floor((now - startedMs) / 1000)) : 0;
    const timeoutSeconds = d.timeout_seconds || 180;
    return {
      ...d,
      elapsed_seconds: elapsedSeconds,
      expired: elapsedSeconds >= timeoutSeconds
    };
  });
  console.log(JSON.stringify({ count: pending.length, pending }, null, 2));
  process.exit(0);
}

fail('Acción inválida. Usa --action <init|record|summary|promote|dispatch|verify-handoff|pending>');
