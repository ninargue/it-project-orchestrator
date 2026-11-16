import type { Register } from 'claude-code';
import { classifyBashCommand, classifyFileAccess } from './guards/destructive.js';
import { classifyDbToolCall } from './policies/db.js';

export const register: Register = (on) => {
  on('session.start', async ($) => {
    await $.command.register({
      name: 'it-project-orchestrator',
      description: 'Inicia el orquestador de proyectos IT: idea-to-backlog y desarrollo con SDD'
    });
  });

  // Ningún subagente puede tocar git; ni orquestador ni subagentes pueden ejecutar órdenes destructivas de BD;
  // y los subagentes DB quedan acotados a sus comandos permitidos.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (e.tool !== 'Bash') return next(e);
    if (e.agentId && /\bgit\b/i.test(e.command)) {
      return { deny: 'Ningún subagente puede ejecutar git: solo el orquestador opera git, tras confirmación del usuario.' };
    }
    const check = classifyBashCommand(e.command, process.env);
    if (check.deny) {
      return { deny: check.reason || 'Comando destructivo de base de datos bloqueado.' };
    }
    if (e.agentId) {
      const agents = await $.agent.list();
      const agentType = agents.find((a) => a.id === e.agentId)?.type;
      const policy = classifyDbToolCall({ agentType, tool: 'Bash', command: e.command });
      if (policy.deny) return { deny: policy.reason || 'Comando Bash fuera de política del subagente DB.' };
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

  // Acotar rutas de escritura/edición por subagente DB
  for (const toolName of ['Write', 'Edit'] as const) {
    on('tool.call', { tool: toolName }, async ($, e, next) => {
      const filePath = (e as { file_path?: string }).file_path || '';
      const accessCheck = classifyFileAccess(filePath);
      if (accessCheck.deny) {
        return { deny: accessCheck.reason || 'Acceso a copia de producción bloqueado.' };
      }
      if (e.agentId) {
        const agents = await $.agent.list();
        const agentType = agents.find((a) => a.id === e.agentId)?.type;
        const policy = classifyDbToolCall({ agentType, tool: toolName, filePath });
        if (policy.deny) return { deny: policy.reason || `Ruta no autorizada para ${agentType}.` };
      }
      return next(e);
    }).catch(($, e, next) => (next.called ? next(e) : { deny: `No se pudo verificar permiso de ${toolName}; operación bloqueada.` }));
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
