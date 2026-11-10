import type { Register } from 'claude-code';

export const register: Register = (on) => {
  on('session.start', async ($) => {
    await $.command.register({
      name: 'it-project-orchestrator',
      description: 'Inicia el orquestador de proyectos IT: idea-to-backlog y desarrollo con SDD'
    });
  });

  // issue-materializer-agent necesita Bash para `gh`, pero nunca debe tocar git.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (e.tool !== 'Bash' || !e.agentId || !/\bgit\b/i.test(e.command)) return next(e);
    const deny = { deny: 'issue-materializer-agent no puede ejecutar git: solo el orquestador opera git, tras confirmación del usuario.' };
    const agents = await $.agent.list().catch(() => undefined);
    if (!agents) return deny; // Sin poder identificar al subagente, se bloquea.
    const caller = agents.find((agent) => agent.id === e.agentId);
    return caller?.type === 'it-project-orchestrator:issue-materializer-agent' ? deny : next(e);
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'No se pudo verificar el permiso de git; comando bloqueado.' }));

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
          'Resuelve contra esa raíz las rutas `_skills/`, `orchestrator/`, `templates/`, `scripts/`, `agents/`, `sdd/README.md`, `docs/tech-briefing-template.md` y `docs/kickoff-brief-template.md`, y Lee esos archivos desde allí. ' +
          'Toda otra ruta `docs/...`, `sdd/...` o `database/...` pertenece al proyecto del usuario (directorio de trabajo). ' +
          'Lanza cada subagente con la herramienta Agent y `subagent_type` `it-project-orchestrator:<nombre>`.',
        'Muestra ahora el menú de punto de entrada tal como lo describe la sección "Punto de Entrada" de las instrucciones anteriores.'
      ]
    };
  });
};
