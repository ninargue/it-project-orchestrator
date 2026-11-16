import type { Register } from 'claude-code';
import { classifyBashCommand, classifyFileAccess } from './guards/destructive.js';
import { classifyBackendRoleAccess } from './guards/backend-roles.js';

export const register: Register = (on) => {
  on('session.start', async ($) => {
    await $.command.register({
      name: 'it-project-orchestrator',
      description: 'Inicia el orquestador de proyectos IT: idea-to-backlog y desarrollo con SDD'
    });
  });

  // Ningún subagente puede tocar git; y ni orquestador ni subagentes pueden ejecutar órdenes destructivas de BD o leer copias de prod.
  on('tool.call', { tool: 'Bash' }, async (_$, e, next) => {
    if (e.tool !== 'Bash') return next(e);
    if (e.agentId && /\bgit\b/i.test(e.command)) {
      return { deny: 'Ningún subagente puede ejecutar git: solo el orquestador opera git, tras confirmación del usuario.' };
    }
    const check = classifyBashCommand(e.command, process.env);
    if (check.deny) {
      return { deny: check.reason || 'Comando destructivo de base de datos bloqueado.' };
    }
    return next(e);
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'No se pudo verificar el permiso de Bash; comando bloqueado.' }));

  // Bloquear lectura/edición de copias de producción (*.dump, *.bak, backups/) y fronteras de rol en backend
  on('tool.call', { tool: 'Read' }, async (_$, e, next) => {
    const filePath = (e as { file_path?: string }).file_path || '';
    const check = classifyFileAccess(filePath);
    if (check.deny) {
      return { deny: check.reason || 'Acceso a copia de producción bloqueado.' };
    }
    const roleCheck = classifyBackendRoleAccess(e.agentId, 'Read', filePath);
    if (roleCheck.deny) {
      return { deny: roleCheck.reason || 'Acceso bloqueado por frontera de rol.' };
    }
    return next(e);
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'No se pudo verificar el permiso de lectura; acceso bloqueado.' }));

  for (const writeTool of ['Write', 'Edit'] as const) {
    on('tool.call', { tool: writeTool }, async (_$, e, next) => {
      const filePath = (e as { file_path?: string }).file_path || '';
      const roleCheck = classifyBackendRoleAccess(e.agentId, writeTool, filePath);
      if (roleCheck.deny) {
        return { deny: roleCheck.reason || 'Escritura bloqueada por frontera de rol.' };
      }
      return next(e);
    }).catch(($, e, next) => (next.called ? next(e) : { deny: `No se pudo verificar el permiso de ${writeTool}; escritura bloqueada.` }));
  }

  on('command.run', { command: 'it-project-orchestrator' }, async ($, _e, _next) => {
    const agentsContent = await $.fs.read($.plugin.root + '/AGENTS.md') as string;
    // El motor rechaza $.prompt.submit dentro de command.run: se envía cuando este hook ya terminó.
    $.clock.after(50, () => {
      $.prompt.submit({ text: 'Inicia el orquestador: muestra el menú de punto de entrada.' })
        .catch(() => $.ui.toast('No se pudo abrir el menú automáticamente: envía cualquier mensaje para verlo.'));
    });
    return {
      text: '▶ it-project-orchestrator iniciado.',
      context: [
        'El usuario ejecutó /it-project-orchestrator. Las instrucciones del orquestador son:\n\n' + agentsContent,
        'Raíz del plugin: ' + $.plugin.root + '\n' +
          'Resuelve contra esa raíz las rutas `_skills/`, `orchestrator/`, `templates/`, `scripts/`, `agents/`, `.claude/commands/opsx/`, `.agent/workflows/`, `sdd/README.md`, `docs/tech-briefing-template.md` y `docs/kickoff-brief-template.md`, y Lee esos archivos desde allí. ' +
          'Toda otra ruta `docs/...`, `sdd/...` o `database/...` pertenece al proyecto del usuario (directorio de trabajo). ' +
          'Lanza cada subagente con la herramienta Agent y `subagent_type` `it-project-orchestrator:<nombre>`.',
        'Muestra ahora el menú de punto de entrada tal como lo describe la sección "Punto de Entrada" de las instrucciones anteriores.'
      ]
    };
  });
};
