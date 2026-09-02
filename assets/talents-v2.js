(function () {
  'use strict';
  const U = window.T4V2, W = window.T4Work, M = window.T4Models, D = window.T4Data, R = window.T4Records, T = window.T4TalentMapping;
  const e = U.esc, a = U.attr;
  const app = U.mount({ module: 'talents', moduleLabel: 'Talentos', defaultView: 'talents', views: [
    { id: 'overview', label: 'Meu dia', title: 'Meu dia', subtitle: 'Prioridades e próximos passos para uma operação mais próxima dos talentos.', icon: 'dashboard' },
    { id: 'talents', label: 'Talentos', title: 'Base de talentos', subtitle: 'Uma ficha por pessoa, com filtros de trabalho e próximo passo visível.', icon: 'users' },
    { id: 'processes', label: 'Seleções', title: 'Seleções', subtitle: 'Cada linha representa Talento + empregador + vaga + etapa.', icon: 'columns' },
    { id: 'presentation', label: 'Apresentações', title: 'Apresentações', subtitle: 'Fila de perfis liberados por decisão humana, antes do envio a uma empresa.', icon: 'check' },
    { id: 'agenda', label: 'Agenda integrada', title: 'Agenda integrada', subtitle: 'Ações vinculadas a Talentos, empresas, contatos e aulas.', icon: 'calendar' },
    { id: 'opportunities', label: 'Mercado', title: 'Mercado e oportunidades', subtitle: 'Vagas cadastradas e Radar NectaNet, sem misturar etapa com oportunidade.', icon: 'briefcase', primary: false },
    { id: 'mapping', label: 'Acompanhamento por Talento', title: 'Acompanhamento por Talento', subtitle: 'Empresa por empresa: aderência, viabilidade e próximos alvos de cada Talento.', icon: 'list', primary: false },
    { id: 'mapping-summary', label: 'Resumo do mapeamento', title: 'Resumo do mapeamento', subtitle: 'Leitura consolidada do acompanhamento, com critérios explícitos.', icon: 'dashboard', primary: false },
    { id: 'mapping-radar', label: 'Radar NectaNet', title: 'Radar NectaNet', subtitle: 'Alvos NectaNet e avaliações individuais; não é etapa nem liberação.', icon: 'briefcase', primary: false },
    { id: 'manual', label: 'Manual de uso', title: 'Manual de uso', subtitle: 'Como decidir, acompanhar e apresentar sem duplicar informações.', icon: 'note', primary: false },
    { id: 'archived', label: 'Arquivo de Talentos', title: 'Arquivo de Talentos', subtitle: 'Histórico de inativos, excluídos e arquivados, sem mistura com a fila ativa.', icon: 'archive', primary: false }
  ] });
  const state = { talents: [], employers: [], openings: [], selections: { rows: [], modern: false }, activities: [], enrollments: [], classes: [], mappingProfiles: [], mappingItems: [], mappingPartners: [], presentationDetails: [], filters: {}, query: '', stage: '', german: '', employer: '', owner: '', quick: [], board: 'list', selectionScope: 'active', selectionShowClosed: false, opportunityScope: 'open', display: 'list', loaded: false, detail: null, detailTab: 'profile', detailVersion: 0 };
  const sources = {
    talents: { label: 'Talentos', load: () => D.loadCandidates({ activeOnly: false }) },
    employers: { label: 'Empregadores', load: () => D.loadEmployers({ activeOnly: false }) },
    openings: { label: 'Oportunidades', load: () => D.loadOpenings() },
    selections: { label: 'Seleções e vínculos anteriores', load: () => D.loadMatches() },
    activities: { label: 'Agenda integrada', load: () => D.loadActivities() },
    enrollments: { label: 'Matrículas de alemão', load: () => D.optionalAll(D.TABLES.enrollments) },
    classes: { label: 'Turmas de alemão', load: () => D.optionalAll(D.TABLES.classes) },
    mappingProfiles: { label: 'Contexto e apresentação do mapeamento', load: () => D.optionalAll(T.TABLES.profiles) },
    mappingItems: { label: 'Linhas do acompanhamento', load: () => D.optionalAll(T.TABLES.items) },
    mappingPartners: { label: 'Complementos Nectanet Partner', load: () => D.optionalAll(T.TABLES.partners) },
    presentationDetails: { label: 'Campos profissionais da apresentação', load: loadPresentationFields }
  };
  const load = W.loader(app, state, sources, render);
  const workspace = window.T4TalentMappingUI.create({ state, app, load, render, talentDetail });
  const active = T.active, yes = T.yes;
  const inCourse = (id) => T.courseFor(state, id);
  const selectionsFor = (id) => state.selections.rows.filter((r) => M.same(r.talent_id, id));
  const attention = (r) => T.attentionReasons(state, r).length > 0;
  const match = (values) => !state.query || M.norm(values.filter(M.present).join(' ')).includes(M.norm(state.query));
  function filtered(archived = false) {
    return workspace.filtered({ archived });
  }
  function talentViews(archived = false) {
    const activeCount = state.talents.filter(active).length;
    const readyCount = state.talents.filter((r) => active(r) && T.yes(r.pronto_para_employer)).length;
    const archivedCount = state.talents.filter((r) => !active(r)).length;
    return `<div class="v25-scope-strip"><div><span class="mx-eyebrow">${archived ? 'ARQUIVO PRESERVADO' : 'FILA OPERACIONAL'}</span><strong>${archived ? `${archivedCount} registro${archivedCount === 1 ? '' : 's'} fora da fila ativa` : `${activeCount} talento${activeCount === 1 ? '' : 's'} ativo${activeCount === 1 ? '' : 's'}`}</strong><span>${archived ? 'Inativos, excluídos, cancelados e arquivados aparecem somente aqui.' : 'Use os filtros abaixo para combinar critérios; os estados negativos não entram nesta visão.'}</span></div>${archived ? W.button('Voltar à fila ativa', 'v24-view', 'all', { className: 'ghost sm', icon: 'users' }) : W.button(`Abrir apresentações · ${readyCount}`, 'v24-view', 'ready', { className: 'ghost sm', icon: 'check' })}</div>`;
  }
  async function loadPresentationFields() {
    let columns = ['id', 'experiencia_profissional_tempo', 'perfil_profissional_para_apresentacao', 'lingua_estrangeira', 'nivel_lingua_estrangeira'];
    const absent = [];
    while (columns.length) {
      try {
        const data = await D.all(D.TABLES.candidates, columns.join(','));
        return { data, available: true, warnings: absent.length ? [`Apresentação: campos ausentes (${absent.join(', ')}). Confira a pré-checagem; nenhum campo foi substituído ou apagado.`] : [] };
      } catch (error) {
        const message = String(error?.message || '');
        const missing = message.match(/column\s+(?:\w+\.)?["']?(\w+)["']?\s+does not exist/i)?.[1] || message.match(/could not find the ['"](\w+)['"] column/i)?.[1];
        if (!D.missingColumn(error) || !missing || !columns.includes(missing) || missing === 'id') throw error;
        absent.push(missing); columns = columns.filter((key) => key !== missing);
      }
    }
  }
  function render() {
    if (!state.loaded) return;
    app.setSearchHandler((q) => { state.query = q; render(); }, app.view === 'agenda' ? 'Buscar atividade ou contexto…' : 'Buscar talento, profissão, cidade ou e-mail…');
    const selectionView = app.view === 'processes' || app.view === 'opportunities';
    const mappingView = app.view === 'mapping';
    app.setPrimaryAction(selectionView ? 'Nova seleção' : app.view === 'agenda' ? 'Nova atividade' : mappingView ? 'Nova linha' : 'Novo talento', D.canEdit() && (!selectionView || state.selections.modern) && (!mappingView || workspace.available('mappingItems') && filtered().length) ? () => selectionView ? R.editSelection(state, null, {}, load) : app.view === 'agenda' ? R.editActivity(state, null, {}, load) : mappingView ? workspace.action('mapping-new', state.mappingTalent || filtered()[0]?.id) : editTalent() : null);
    app.setCounts({ talents: state.talents.filter(active).length, archived: state.talents.filter((r) => !active(r)).length, processes: state.selections.rows.filter((r) => M.selectionBucket(r) !== 'closed').length, agenda: state.activities.filter((r) => M.isOpen(r.status)).length });
    const html = ({ overview, talents: () => directory(false), archived: () => directory(true), mapping: workspace.tracking, presentation: workspace.presentation, 'mapping-summary': workspace.summary, 'mapping-radar': workspace.radar, processes: selectionsView, opportunities: opportunitiesView, agenda: agendaView, manual: () => window.T4Modern?.manual() || W.note('Manual indisponível.') }[app.view] || overview)();
    app.pageRoot.innerHTML = W.sourceAlerts(state) + html;
  }
  function overview() {
    const list = state.talents.filter(active), day = M.today();
    const actions = state.activities.filter((r) => M.isOpen(r.status) && (!r.due_at || M.dateOnly(r.due_at) <= day) && match([r.title, R.talentName(state, r.talent_id), r.notes]));
    const selected = list.filter(attention);
    return `<div class="t4-work-intro"><div><span class="t4-overline">SEU ESPAÇO DE TRABALHO</span><h2>Informação clara. Próximo passo definido.</h2><p>Bom trabalho, ${e(D.profile?.nome || 'equipe')}. Aqui está o que precisa avançar.</p></div><span class="t4-date-chip">${U.icon('calendar')}${e(new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }))}</span></div>
      <section class="t4-kpi-grid">${U.kpi('Talentos ativos', list.length, 'Uma ficha por pessoa')}${U.kpi('Em seleções', new Set(state.selections.rows.filter((r) => !['closed', 'hired'].includes(M.selectionBucket(r))).map((r) => r.talent_id)).size, 'Vínculos com empregadores')}${U.kpi('Em aulas de alemão', new Set(state.enrollments.filter((r) => ['Matriculado', 'Ativo', 'Pausado'].includes(r.status)).map((r) => r.candidate_id)).size, 'Matrículas em acompanhamento')}${U.kpi('Precisam de atenção', selected.length, 'Prioridade, prazo ou pendência', selected.length ? 'warn' : 'good')}</section>
      ${W.section('Sua fila de ação', R.activityTable(state, actions, 'today-actions'), W.button('Abrir agenda', 'go', 'agenda', { className: 'sm', icon: 'arrow' }), 'Atividades para hoje, vencidas ou ainda sem prazo definido.')}
      ${W.section('Talentos para acompanhar', talentListTable(selected.filter((r) => match([r.nome_completo, r.profissao_principal])), 'attention-talents'), W.button('Ver toda a base', 'go', 'talents', { className: 'sm' }), 'Atenção é uma fila calculada de trabalho, não uma etapa do Talento.')}
      <div class="t4-shortcuts">${W.button('Consultar oportunidades', 'go', 'opportunities', { icon: 'briefcase' })}${W.link('Planejamento dos empregadores', './organizacional.html?view=planning', 'building')}${W.link('Acompanhamento de alemão', './alemao.html?view=attention', 'graduation')}${W.link('Agenda de contatos', './contatos.html', 'contact')}</div>`;
  }
  function directory(archived) {
    if (!archived && state.quick.includes('ready')) return workspace.presentation();
    const rows = filtered(archived);
    const mode = `<div class="mx-toolbar"><div><span class="mx-eyebrow">${archived ? 'HISTÓRICO PRESERVADO' : 'FICHA ÚNICA DE CADA TALENTO'}</span><p class="t4-muted">${rows.length} registro(s) neste recorte</p></div><div class="mx-segment" role="group" aria-label="Visualização da base"><button type="button" data-action="talent-display" data-id="cards" data-selected="${state.display === 'cards'}">Cartões</button><button type="button" data-action="talent-display" data-id="list" data-selected="${state.display === 'list'}">Lista</button><button type="button" data-action="talent-display" data-id="table" data-selected="${state.display === 'table'}">Tabela completa</button></div></div>`;
    return `${talentViews(archived)}${archived ? W.note('Nenhum talento é excluído por esta tela. A ficha completa, as seleções e o histórico de aulas continuam acessíveis.') : workspace.quickFilters()}${workspace.toolbar({archived})}${!archived ? W.note('A acompanhar: há uma pendência, um risco ou um próximo passo vencido. O motivo aparece na coluna Atenção e na ficha.', 'info') : ''}${mode}${state.display === 'cards' ? talentCards(rows) : state.display === 'table' ? talentTable(rows, 'talents-complete') : talentListTable(rows)}`;
  }
  function talentCards(list) {
    return `<div class="mx-cards">${list.map((r) => {
      const p = T.profileFor(state, r.id), links = [...new Set(T.mappingRows(state).filter((x) => M.same(x.talent_id, r.id) && x._employer).map((x) => x._employer))];
      const actions = window.T4Modern?.nextActions(state, r.id) || [], first = actions[0];
      const ready = T.yes(r.pronto_para_employer), radar = T.mappingRows(state).some((x) => M.same(x.talent_id, r.id) && T.yes(x.nectanet));
      return `<article class="mx-card"><div class="mx-person-header" style="padding:0;border:0;margin:0;background:transparent"><div><span class="mx-eyebrow">${e(r.status_pipeline || 'Sem etapa')}</span><h3>${e(r.nome_completo || 'Sem nome')}</h3><p class="mx-meta">${e([r.profissao_principal || r.area_profissional, r.cidade_atual, r.responsavel_interno].filter(Boolean).join(' · ') || 'Dados principais não informados')}</p></div>${W.button('Abrir ficha','talent-detail',r.id,{className:'sm ghost',icon:'chevron'})}</div><div class="t4-chip-row">${U.badge(r.nivel_alemao || 'Alemão não informado','info')}${ready ? U.badge('Liberado para apresentação','success') : U.badge('Em preparação')}${radar ? U.badge('Radar NectaNet','info') : ''}</div><div class="mx-fact"><h3>Próximo passo</h3><p class="mx-next">${e(first?.text || 'Definir uma próxima ação')}</p><small class="mx-meta">${e([first?.source, first?.due ? U.formatDate(first.due) : '', first?.owner].filter(Boolean).join(' · ') || 'Sem prazo ou responsável')}</small></div>${links.length ? `<div class="t4-chip-row">${links.slice(0,4).map(window.T4Modern?.employer || ((x)=>e(x.nome))).join('')}</div>` : '<p class="mx-meta">Sem empregador ou vaga vinculada.</p>'}<footer>${W.button('Acompanhar','mapping-for',r.id,{className:'sm',icon:'list'})}${D.canEdit() ? W.button(ready ? 'Revisar liberação' : 'Preparar apresentação','readiness',r.id,{className:'sm ghost'}) : ''}</footer></article>`;
    }).join('') || U.emptyState('Nenhum Talento neste filtro','Ajuste a busca ou limpe os filtros para continuar.')}</div>`;
  }
  function talentTable(list, id = 'talents') {
    return W.table({ id, rows: list, columns: [
      { key: 'nome_completo', label: 'Talento', required: true, render: (r) => W.person(r.nome_completo || 'Sem nome', r.cidade_atual || r.id, '', 'talent-detail', r.id) },
      { key: 'profissao_principal', label: 'Profissão / área', render: (r) => W.stack(r.profissao_principal || r.area_profissional, r.profissao_principal ? r.area_profissional : '') },
      { key: 'status_pipeline', label: 'Acompanhamento', render: (r) => W.status(U.term(r.status_pipeline || 'Sem etapa')) },
      { key: 'nivel_alemao', label: 'Alemão', render: (r) => { const course = inCourse(r.id); return `<div class="t4-chip-row">${U.badge(course[0]?.current_level || r.nivel_alemao || 'Não informado', 'info')}</div><small class="t4-cell-secondary">${course.length ? `${course.length} matrícula(s) · dados do curso` : 'Informado no perfil'}</small>`; } },
      { key: 'documentacao_completa', label: 'Documentação', render: (r) => U.badge(yes(r.documentacao_completa) ? 'Completa' : M.present(r.documentacao_completa) ? 'Em preparação' : 'Não avaliada', yes(r.documentacao_completa) ? 'success' : '') },
      { key: 'employer', label: 'Empregadores', render: (r) => { const names = [...new Set(selectionsFor(r.id).filter((s) => M.selectionBucket(s) !== 'closed').map((s) => R.employerName(state, s.employer_id)))]; return names.length ? `<span class="t4-clamp-3">${e(names.join(' · '))}</span>` : '<span class="t4-muted">Sem seleção vinculada</span>'; } },
      { key: 'responsavel_interno', label: 'Responsável' },
      { key: 'pronto_para_employer', label: 'Apresentação', render: (r) => `<div class="t4-chip-row">${U.badge(yes(r.pronto_para_employer) ? 'Liberado' : M.present(r.pronto_para_employer) ? 'Em preparação' : 'Não revisado', yes(r.pronto_para_employer) ? 'success' : '')}${D.canEdit() ? W.button('Revisar', 'readiness', r.id, {className:'ghost sm'}) : ''}</div>` },
      { key: 'attention', label: 'Atenção', render: (r) => `<span class="t4-cell-secondary">${e(T.attentionReasons(state,r).join(' · ') || 'Sem alertas neste recorte')}</span>` },
      { key: 'actions', label: '', sort: false, render: (r) => `<div class="t4-chip-row">${W.button('Acompanhar', 'mapping-for', r.id, { className: 'sm', icon: 'list' })}${W.button('Ficha', 'talent-detail', r.id, { className: 'sm ghost', icon: 'chevron' })}</div>` }
    ] });
  }
  function talentListTable(list, id = 'talents-list') {
    return W.table({ id, rows: list, empty: 'Ajuste a busca ou os filtros para continuar.', columns: [
      { key: 'nome_completo', label: 'Talento', required: true, render: (r) => W.person(r.nome_completo || 'Sem nome', [r.profissao_principal || r.area_profissional, r.cidade_atual].filter(Boolean).join(' · ') || 'Perfil ainda incompleto', '', 'talent-detail', r.id) },
      { key: 'status_pipeline', label: 'Etapa do perfil', render: (r) => W.status(U.term(r.status_pipeline || 'Sem etapa')) },
      { key: 'next_action', label: 'Próximo passo', value: (r) => window.T4Modern?.nextActions(state, r.id)?.[0]?.text || '', render: (r) => { const next = window.T4Modern?.nextActions(state, r.id)?.[0]; return W.stack(next?.text || 'Definir ação', next ? [next.source, next.due ? U.formatDate(next.due) : '', next.owner].filter(Boolean).join(' · ') : 'Nenhuma ação registrada'); } },
      { key: 'nivel_alemao', label: 'Alemão', render: (r) => { const course = inCourse(r.id); return W.stack(course[0]?.current_level || r.nivel_alemao || 'Não informado', course.length ? `${course.length} matrícula(s) em acompanhamento` : 'Somente perfil'); } },
      { key: 'pronto_para_employer', label: 'Apresentação', render: (r) => U.badge(yes(r.pronto_para_employer) ? 'Liberado' : M.present(r.pronto_para_employer) ? 'Em preparação' : 'Não revisado', yes(r.pronto_para_employer) ? 'success' : '') },
      { key: 'attention', label: 'Atenção', value: (r) => T.attentionReasons(state, r).length, render: (r) => { const reasons = T.attentionReasons(state, r); return reasons.length ? `<span class="v25-attention-copy">${e(reasons.join(' · '))}</span>` : '<span class="t4-muted">Nenhum alerta</span>'; } },
      { key: 'actions', label: '', sort: false, render: (r) => `<div class="t4-chip-row">${W.button('Acompanhar', 'mapping-for', r.id, { className: 'sm', icon: 'list' })}${W.button('Ficha', 'talent-detail', r.id, { className: 'sm ghost', icon: 'chevron' })}</div>` }
    ] });
  }
  function selectionsView() {
    const all = state.selections.rows.filter((r) => T.matches(state.workFilters.selectionStage,r.stage) && T.matches(state.workFilters.selectionEmployer,r.employer_id) && T.matches(state.workFilters.selectionOwner,r.owner_username) && match([R.talentName(state, r.talent_id), R.employerName(state, r.employer_id), W.find(state.openings, r.opening_id)?.title, r.next_action]));
    const activeRows = all.filter((r) => M.selectionBucket(r) !== 'closed'), closed = all.filter((r) => M.selectionBucket(r) === 'closed');
    const scope = state.selectionScope || 'active', visible = scope === 'closed' ? closed : scope === 'all' ? all : activeRows;
    const scopeBar = W.chips([{ id: 'active', label: 'Em andamento', count: activeRows.length, icon: 'columns' }, { id: 'all', label: 'Todas as relações', count: all.length, icon: 'list' }, { id: 'closed', label: 'Encerradas', count: closed.length, icon: 'archive' }], scope, 'selection-scope');
    const view = state.board === 'list' || scope === 'closed' ? R.selectionTable(state, visible, scope === 'closed' ? 'talent-closed-selections' : 'talent-selections') : R.selectionBoard(state, activeRows);
    return `<div class="v25-page-intro"><div><span class="mx-eyebrow">SELEÇÕES</span><h2>Relações de trabalho por Talento.</h2><p>Seleção = Talento + empregador + vaga + etapa. Encerrados ficam separados para não competir com a fila diária.</p></div><span class="v25-result-count">${activeRows.length} ativa${activeRows.length === 1 ? '' : 's'}</span></div>${scopeBar}<div class="t4-view-context"><p>O <strong>registro analítico</strong> é a visão principal para prazos, responsáveis e decisões. O quadro é opcional e não substitui a ficha do Talento.</p>${W.chips([{ id: 'list', label: 'Lista analítica', icon: 'list' }, { id: 'board', label: 'Quadro opcional', icon: 'columns' }], state.board, 'board')}</div>${workspace.workToolbar('selections')}${view}${scope !== 'closed' && closed.length ? `<div class="v25-archive-callout"><div><strong>${closed.length} relação${closed.length === 1 ? '' : 'ões'} encerrada${closed.length === 1 ? '' : 's'} separada${closed.length === 1 ? '' : 's'} da fila.</strong><span>Abra o filtro “Encerradas” quando precisar consultar o histórico.</span></div>${W.button('Abrir histórico', 'selection-scope', 'closed', { className: 'ghost sm', icon: 'archive' })}</div>` : ''}`;
  }
  function opportunitiesView() {
    const closed = (r) => /fechad|cancel|arquiv|removid|encerr/i.test(M.norm(r.status || '')) || !!r.deleted_at;
    const scope = state.opportunityScope || 'open';
    const list = state.openings.filter((r) => (scope === 'open' ? !closed(r) : scope === 'closed' ? closed(r) : true) && T.matches(state.workFilters.selectionEmployer,r.employer_id) && match([r.title, r.area, r.location, R.employerName(state, r.employer_id)]));
    const count = (id) => state.openings.filter((r) => id === 'open' ? !closed(r) : id === 'closed' ? closed(r) : true).length;
    const marketNav = `<div class="mx-toolbar"><div><span class="mx-eyebrow">MERCADO</span><p class="t4-muted">Vagas cadastradas e oportunidades NectaNet</p></div><div class="mx-segment" role="group" aria-label="Visões do mercado"><button type="button" data-action="go" data-id="opportunities" data-selected="${app.view === 'opportunities'}">Vagas cadastradas</button><button type="button" data-action="go" data-id="mapping-radar" data-selected="${app.view === 'mapping-radar'}">Radar NectaNet</button></div></div>`;
    return marketNav + W.chips([{ id: 'open', label: 'Abertas', count: count('open'), icon: 'briefcase' }, { id: 'all', label: 'Todas', count: count('all'), icon: 'list' }, { id: 'closed', label: 'Encerradas', count: count('closed'), icon: 'archive' }], scope, 'opportunity-scope') + workspace.workToolbar('openings') + W.table({ id: 'talent-openings', rows: list, columns: [
      { key: 'title', label: 'Oportunidade', required: true, render: (r) => W.stack(r.title, R.employerName(state, r.employer_id)) }, { key: 'location', label: 'Localização' }, { key: 'language_requirement', label: 'Idioma requerido' }, { key: 'quantity', label: 'Posições' }, { key: 'status', label: 'Situação', render: (r) => W.status(r.status) },
      { key: 'actions', label: '', sort: false, render: (r) => `<div class="t4-chip-row">${W.link('Ver empregador', `./organizacional.html?employer=${encodeURIComponent(r.employer_id)}`)}${D.canEdit() && state.selections.modern ? W.button('Vincular talento', 'select-opening', r.id, { className: 'sm', icon: 'plus' }) : ''}</div>` }
    ] });
  }
  function agendaView() {
    const list = state.activities.filter((r) => T.matches(state.workFilters.activityOwner,r.owner_username) && match([r.title, r.notes, r.outcome, R.talentName(state, r.talent_id), R.employerName(state, r.employer_id)]));
    const academic = state.enrollments.filter((r) => r.next_action && ['Matriculado', 'Ativo', 'Pausado'].includes(r.status) && match([r.next_action, R.talentName(state, r.candidate_id)]));
    return `${workspace.workToolbar('activities')}${R.activityTable(state, list)}${W.section('Acompanhamentos do curso de alemão', W.table({ id: 'academic-agenda', rows: academic, columns: [
      { key: 'candidate_id', label: 'Talento', required: true, render: (r) => e(R.talentName(state, r.candidate_id)) }, { key: 'next_action', label: 'Próxima ação' }, { key: 'next_action_due', label: 'Prazo', render: (r) => e(U.formatDate(r.next_action_due)) }, { key: 'owner_name', label: 'Responsável' }, { key: 'link', label: '', sort: false, render: (r) => W.link('Abrir matrícula', `./alemao.html?enrollment=${encodeURIComponent(r.id)}`, 'graduation') }
    ] }), W.link('Calendário organizacional', './organizacional.html?view=calendar', 'calendar'))}`;
  }
  async function talentDetail(id) {
    const version = ++state.detailVersion;
    const brief = W.find(state.talents, id);
    const drawer = U.openDrawer({ title: brief?.nome_completo || 'Ficha do talento', subtitle: 'Carregando o cadastro completo…', body: '<div class="t4-skeleton"></div>' });
    try {
      const full = await D.one(D.TABLES.candidates, id);
      if (version !== state.detailVersion || !drawer.isConnected) return;
      state.detail = full; state.detailTab = 'profile'; renderDetail();
    } catch (err) { if (drawer.isConnected) drawer.querySelector('.t4-drawer-body').innerHTML = W.note(W.formatError(err), 'error') + W.button('Tentar novamente', 'talent-detail', id, { className: 'primary sm' }); }
  }
  const DETAIL_TABS = [{ id: 'profile', label: 'Perfil' }, { id: 'selections', label: 'Seleções' }, { id: 'course', label: 'Alemão' }, { id: 'documents', label: 'Documentos' }, { id: 'history', label: 'Histórico' }, { id: 'all', label: 'Todos os dados' }];
  function renderDetail() {
    const r = state.detail;
    if (!r) return;
    const detailActions = `${D.canEdit() ? W.button('Editar ficha', 'edit-talent', r.id, { className: 'primary sm', icon: 'edit' }) + W.button('Nova atividade', 'activity-for', r.id, { className: 'sm', icon: 'plus' }) + W.button('Preparar Nectanet', 'presentation-profile', r.id, {className:'sm',disabled:!workspace.available('mappingProfiles')}) + W.button('Revisar liberação', 'readiness', r.id, {className:'sm'}) : ''}${W.button('Acompanhamento', 'mapping-for', r.id, {className:'sm',icon:'list'})}${W.button('Preparar PDF', 'pdf', r.id, { className: 'sm', icon: 'download' })}${W.link('Contato', `./contatos.html?talent=${encodeURIComponent(r.id)}`, 'contact')}`;
    let html = '';
    if (state.detailTab === 'profile') html = `<div class="t4-profile-lead"><span class="t4-avatar large">${e(U.initials(r.nome_completo))}</span><div><h3>${e(r.profissao_principal || r.area_profissional || 'Profissão não informada')}</h3><p>${e([r.cidade_atual, r.pais_de_origem].filter(Boolean).join(' · '))}</p>${W.status(U.term(r.status_pipeline))}</div></div><div class="t4-detail-grid">${U.field('E-mail', r.email)}${U.field('Telefone', r.telefone)}${U.field('Responsável', r.responsavel_interno)}${U.field('Prioridade', r.prioridade_comercial)}${U.field('Área profissional', r.area_profissional)}${U.field('Disponibilidade de mudança', r.disponibilidade_mudanca)}</div>${W.section('Perfil profissional', `<p class="t4-preserve">${e(r.perfil_profissional_para_apresentacao || r.resumo_profissional || r.resumo_rh_curto || 'Não informado')}</p><div class="t4-detail-grid">${U.field('Formação', r.curso_de_graduacao)}${U.field('Instituição', r.universidade)}${U.field('Pós-graduação', r.posgraduacao)}${U.field('Experiência', r.experiencia_profissional_tempo)}</div><p class="t4-preserve">${e(r.relato_sobre_a_experiencia_profissional || '')}</p>`)}${W.section('Contexto interno', `<p class="t4-preserve">${e(r.observacoes_internas || r.observacao || 'Sem observações internas.')}</p>`)}${D.canEdit() ? W.button(active(r) ? 'Arquivar talento' : 'Reativar talento', 'archive-talent', r.id, { className: 'sm', icon: 'archive' }) : ''}`;
    else if (state.detailTab === 'selections') {
      const relationships = selectionsFor(r.id), activeRelationships = relationships.filter((item) => M.selectionBucket(item) !== 'closed'), archivedRelationships = relationships.filter((item) => M.selectionBucket(item) === 'closed');
      html = `<div class="v25-inline-help">A fila mostra relações em andamento. Encerradas permanecem preservadas no histórico e só aparecem abaixo, em uma seção separada.</div>${R.selectionTable(state, activeRelationships, 'talent-selections')}${archivedRelationships.length ? W.section('Histórico de seleções encerradas', R.selectionTable(state, archivedRelationships, 'talent-closed-selections'), W.badge(`${archivedRelationships.length} preservada(s)`, 'info')) : ''}${D.canEdit() && state.selections.modern ? W.button('Nova seleção', 'selection-for-talent', r.id, { className: 'primary', icon: 'plus' }) : ''}`;
    }
    else if (state.detailTab === 'course') html = `<div class="t4-detail-grid">${U.field('Nível informado no perfil', r.nivel_alemao)}${U.field('Instituição (cadastro anterior)', r.instituicao_ensino)}${U.field('Nível-alvo (perfil)', r.nivel_alvo)}${U.field('Previsão de término', U.formatDate(r.previsao_termino_alemao))}${U.field('Bolsa concedida', r.bolsa_concedida)}${U.field('Bolsa percentual', r.bolsa_percentual)}</div>` + state.enrollments.filter((en) => M.same(en.candidate_id, r.id)).map((en) => W.section(W.find(state.classes, en.class_id)?.name || 'Matrícula', `<div class="t4-detail-grid">${U.field('Situação', en.status)}${U.field('Nível no curso', en.current_level)}${U.field('Meta', en.target_level)}${U.field('Presença', M.finite(en.attendance_percent) ? `${en.attendance_percent}%` : 'Sem registro')}${U.field('Prova', en.exam_status)}${U.field('Responsável', en.owner_name)}</div><p>${e(en.next_action || '')}</p><small>${e(U.formatDate(en.next_action_due))}</small>`, W.link('Abrir acompanhamento', `./alemao.html?enrollment=${encodeURIComponent(en.id)}`, 'graduation'))).join('') + W.link('Ir para Alemão', `./alemao.html?talent=${encodeURIComponent(r.id)}`, 'graduation');
    else if (state.detailTab === 'documents') html = W.note('Consulta dos dados e links já cadastrados. Não há upload nem sincronização com Google nesta versão.') + `<div class="t4-detail-grid">${[['Documentação completa', r.documentacao_completa], ['Pendência crítica', r.pendencia_documental_critica], ['Passaporte', r.passaporte_status], ['Validade', r.passaporte_validade || r.validade_do_passaporte], ['Diploma', r.diploma_status || r.diploma], ['Histórico', r.historico_status || r.historico], ['Registro profissional', r.registro_status], ['Reconhecimento', r.anabin]].map(([k, v]) => U.field(k, v)).join('')}</div><div class="t4-resource-links">${[['Currículo', r.cv_drive_web_link], ['Passaporte', r.passaporte_arquivo], ['Diploma', r.diploma_arquivo], ['Histórico', r.historico_arquivo], ['Registro profissional', r.registro_arquivo]].map(([label, url]) => W.external(label, url)).join('')}</div>`;
    else if (state.detailTab === 'history') html = R.activityTable(state, state.activities.filter((ac) => M.same(ac.talent_id, r.id)), 'talent-activities') + `<div class="t4-detail-grid">${U.field('Entrada na base', U.formatDate(r.data_da_candidatura))}${U.field('Última atualização', U.formatDate(r.ultima_atualizacao, true))}${U.field('Atualizado por', r.atualizado_por)}${U.field('Motivo de saída', r.motivo_inativacao)}${U.field('Data de inativação', U.formatDate(r.data_inativacao))}${U.field('Reativável', r.reativavel)}</div><details class="t4-disclosure"><summary>Histórico operacional anterior</summary><pre class="t4-raw">${e(typeof r.historico_operacional === 'object' ? JSON.stringify(r.historico_operacional, null, 2) : r.historico_operacional || 'Sem histórico neste campo.')}</pre></details>`;
    else html = W.note('Leitura completa dos campos presentes no cadastro. Campos sem apresentação dedicada continuam preservados, inclusive estruturas antigas. Valores não editados não são enviados ao salvar.') + R.storedFields(r);
    U.openDrawer({ title: r.nome_completo, subtitle: `${r.id} · ${active(r) ? 'Talento ativo' : 'Arquivado'}`, actions: detailActions, body: `<nav class="t4-detail-tabs" aria-label="Seções da ficha">${DETAIL_TABS.map((tab) => `<button type="button" data-action="detail-tab" data-id="${a(tab.id)}" aria-pressed="${tab.id === state.detailTab}" class="${tab.id === state.detailTab ? 'active' : ''}">${e(tab.label)}</button>`).join('')}</nav>${html}` });
  }
  const BASIC_FIELDS = [
    { section: 'Identificação e contato' }, { name: 'nome_completo', label: 'Nome completo', required: true, wide: true },
    ...R.fields([['email', 'E-mail', 'email'], ['telefone', 'Telefone'], ['cidade_atual', 'Cidade atual'], ['pais_de_origem', 'País de origem'], ['idade', 'Idade']]),
    { section: 'Perfil profissional' },
    ...R.fields([['profissao_principal', 'Profissão principal'], ['area_profissional', 'Área profissional'], ['universidade', 'Instituição de formação'], ['curso_de_graduacao', 'Curso de graduação'], ['posgraduacao', 'Pós-graduação'], ['experiencia_profissional_tempo', 'Tempo de experiência'], ['anabin', 'Reconhecimento / Anabin'], ['perfil_profissional_para_apresentacao', 'Perfil para apresentação', 'textarea'], ['resumo_profissional', 'Resumo profissional', 'textarea'], ['resumo_rh_curto', 'Resumo executivo de RH', 'textarea'], ['relato_sobre_a_experiencia_profissional', 'Experiência profissional', 'textarea']]),
    { section: 'Idioma informado no perfil' },
    { name: 'nivel_alemao', label: 'Nível de alemão (perfil)', type: 'select', options: R.LEVELS },
    ...R.fields([['lingua_estrangeira', 'Outro idioma'], ['nivel_lingua_estrangeira', 'Nível do outro idioma'], ['instituicao_ensino', 'Instituição anterior'], ['nivel_alvo', 'Nível-alvo do perfil', 'select', R.LEVELS], ['previsao_termino_alemao', 'Previsão de término', 'date'], ['resultado_da_prova', 'Resultado de prova registrado no perfil'], ['bolsa_concedida', 'Bolsa concedida'], ['bolsa_percentual', 'Bolsa (%)', 'number']]),
    { section: 'Acompanhamento interno' },
    { name: 'status_pipeline', label: 'Etapa de acompanhamento', type: 'select', options: ['Novo candidato', 'Triagem', 'Pré-seleção', 'Entrevista', 'Análise', 'Curso de Alemão', 'Documentação', 'Pronto para employer', 'Enviado ao employer', 'Contratado'], required: true, placeholder: null },
    { name: 'responsavel_interno', label: 'Responsável interno' }, { name: 'prioridade_comercial', label: 'Prioridade', type: 'select', options: R.PRIORITIES },
    ...R.fields([['disponibilidade_mudanca', 'Disponibilidade de mudança'], ['data_prevista_mudanca', 'Previsão de mudança', 'date'], ['observacoes_internas', 'Observações internas', 'textarea'], ['observacao', 'Outras observações', 'textarea']]),
    { section: 'Documentação · situação informada' },
    ...R.fields([['passaporte_status', 'Situação do passaporte'], ['passaporte_numero', 'Número do passaporte'], ['passaporte_validade', 'Validade', 'date'], ['diploma_status', 'Situação do diploma'], ['historico_status', 'Situação do histórico'], ['registro_status', 'Situação do registro profissional'], ['registro_numero', 'Número do registro'], ['registro_validade', 'Validade do registro', 'date'], ['pendencia_documental_critica', 'Pendência documental crítica', 'textarea'],['cv_drive_web_link','Link do CV','url']])
  ];
  async function editTalent(row) {
    if (!D.canEdit()) return;
    const original = row?.id ? await D.one(D.TABLES.candidates, row.id) : null;
    const data = original || { status_pipeline: 'Novo candidato', prioridade_comercial: 'Normal', responsavel_interno: D.profile.nome };
    const createNames = ['nome_completo', 'email', 'telefone', 'cidade_atual', 'pais_de_origem', 'profissao_principal', 'area_profissional', 'nivel_alemao', 'status_pipeline', 'responsavel_interno', 'prioridade_comercial', 'resumo_rh_curto'];
    const definitions = BASIC_FIELDS.filter((f) => f.section || (original ? f.name in original : createNames.includes(f.name)));
    // Retira títulos de seções que não têm campos disponíveis neste cadastro.
    const shown = definitions.filter((f, i) => !f.section || definitions[i + 1] && !definitions[i + 1].section);
    const newId = `T4-${new Date().getFullYear()}-${D.uuid().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    return W.form({ title: original ? 'Editar ficha do talento' : 'Novo talento', row: data, fields: shown,
      notice: 'Somente campos alterados serão gravados. A evolução das aulas e as seleções continuam ligadas a esta ficha; não são substituídas por uma mudança de etapa.',
      onSubmit: async (values, changes) => {
        if ('cv_drive_web_link' in changes && changes.cv_drive_web_link && !M.safeUrl(changes.cv_drive_web_link)) throw new Error('Informe um link HTTP ou HTTPS válido, sem credenciais embutidas.');
        if (original) {
          if (Object.keys(changes).length) {
            if ('status_pipeline' in changes && 'data_entrada_etapa_atual' in original) changes.data_entrada_etapa_atual = new Date().toISOString();
            changes.ultima_atualizacao = new Date().toISOString();
            if ('atualizado_por' in original) changes.atualizado_por = D.profile.nome;
            await D.update(D.TABLES.candidates, original.id, changes, original.ultima_atualizacao ? { expectedUpdatedAt: original.ultima_atualizacao, expectedColumn: 'ultima_atualizacao' } : {});
          }
        } else {
          const repeated = values.email && state.talents.find((r) => M.norm(r.email) === M.norm(values.email));
          if (repeated) throw new Error('Já existe um talento com este e-mail. Confira a ficha existente antes de criar outra.');
          await D.insert(D.TABLES.candidates, { ...values, id: newId, ativo: true, data_da_candidatura: M.today(), ultima_atualizacao: new Date().toISOString() });
        }
        U.toast('Ficha salva no cadastro único de talentos.', 'success');
        await load();
        if (original && state.detail?.id === original.id) { state.detail = await D.one(D.TABLES.candidates, original.id); renderDetail(); }
      } });
  }
  async function archiveTalent(row) {
    if (!D.canEdit()) return;
    const original = await D.one(D.TABLES.candidates, row.id), restoring = !active(original);
    return W.form({ title: restoring ? 'Reativar talento' : 'Arquivar talento', subtitle: original.nome_completo,
      notice: 'A ficha, as matrículas e os vínculos seletivos não serão excluídos. Seleções em andamento permanecem no histórico para revisão individual.',
      fields: [{ name: 'reason', label: restoring ? 'Motivo da reativação' : 'Motivo do arquivamento', type: 'textarea', required: true, wide: true }],
      submitLabel: restoring ? 'Reativar talento' : 'Arquivar talento', onSubmit: async (values) => {
        const patch = { ativo: restoring, data_inativacao: restoring ? null : M.today(), ultima_atualizacao: new Date().toISOString() };
        if (!restoring) { patch.motivo_inativacao = values.reason; if ('etapa_de_saida' in original) patch.etapa_de_saida = original.status_pipeline; }
        if ('observacao_final_de_saida' in original) patch.observacao_final_de_saida = [original.observacao_final_de_saida, `${M.today()} · ${restoring ? 'Reativação' : 'Arquivamento'}: ${values.reason}${restoring && original.data_inativacao ? ` (arquivado anteriormente em ${original.data_inativacao})` : ''}`].filter(Boolean).join('\n');
        await D.update(D.TABLES.candidates, original.id, patch, original.ultima_atualizacao ? { expectedUpdatedAt: original.ultima_atualizacao, expectedColumn: 'ultima_atualizacao' } : {});
        U.toast(restoring ? 'Talento reativado.' : 'Talento arquivado, com histórico preservado.', 'success');
        U.closeDrawer(); await load();
      } });
  }
  W.bind(app, { change(key, value) { if (workspace.change(key,value)) return; state[key] = value; render(); }, async action(action, id) {
    if (action === 'reload') return D.session ? load() : location.reload();
    if (action === 'go') return app.route(id);
    if (action === 'v24-view') {
      if (id === 'archived') { state.quick = []; app.route('archived'); return; }
      if (id === 'ready') { state.quick = ['ready']; app.route('presentation'); return; }
      state.quick = id === 'all' ? [] : [id];
      app.route('talents');
      return;
    }
    if (action === 'talent-display') { state.display = ['cards','list','table'].includes(id) ? id : 'list'; render(); return; }
    if (action === 'clear') { state.stage = ''; state.german = ''; state.employer = ''; state.owner = ''; state.filters = {}; state.workFilters = {}; state.quick = []; state.selectionScope = 'active'; state.selectionShowClosed = false; state.opportunityScope = 'open'; state.mappingStatus = []; state.multiSearch = {}; state.query = ''; app.resetSearch(); render(); return; }
    if (await workspace.action(action,id)) return;
    if (action === 'board') { state.board = id; render(); return; }
    if (action === 'selection-scope') { state.selectionScope = ['active', 'all', 'closed'].includes(id) ? id : 'active'; render(); return; }
    if (action === 'opportunity-scope') { state.opportunityScope = ['open', 'all', 'closed'].includes(id) ? id : 'open'; render(); return; }
    if (action === 'talent-detail') return talentDetail(id);
    if (action === 'detail-tab') { state.detailTab = id; renderDetail(); return; }
    if (action === 'edit-talent') return editTalent({ id });
    if (action === 'archive-talent') return archiveTalent({ id });
    if (action === 'selection-detail') return R.selectionDrawer(state, state.selections.rows.find((r) => r.key === id));
    if (action === 'edit-selection') return R.editSelection(state, state.selections.rows.find((r) => r.key === id), {}, load);
    if (action === 'selection-for-talent') return R.editSelection(state, null, { talent_id: id }, load);
    if (action === 'select-opening') return R.editSelection(state, null, { opening_id: id }, load);
    if (action === 'edit-activity') return R.editActivity(state, W.find(state.activities, id), {}, load);
    if (action === 'activity-for') return R.editActivity(state, null, { talent_id: id }, load);
    if (action === 'finish-activity') return R.finishActivity(W.find(state.activities, id), load);
    if (action === 'pdf') { const row = state.detail?.id === id ? state.detail : await D.one(D.TABLES.candidates, id); return window.T4PDF.open(row, state); }
  } });
  app.onRoute(() => { state.multiOpen = ''; if (app.view === 'archived') state.quick = []; if (app.view === 'talents') state.quick = state.quick.filter((v) => v !== 'ready'); render(); });
  W.start(app, async () => {
    await load();
    const id = new URLSearchParams(location.search).get('talent');
    if (id && !state.openedInitial) { state.openedInitial = true; await talentDetail(id); }
  }, [D.TABLES.candidates, D.TABLES.employers, D.TABLES.openings, D.TABLES.matches, D.TABLES.legacyMatches, D.TABLES.legacyLinks, D.TABLES.activities, D.TABLES.contacts, D.TABLES.enrollments, D.TABLES.classes, ...Object.values(T.TABLES)]);
})();
