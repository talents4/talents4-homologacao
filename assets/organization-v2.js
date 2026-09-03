(function () {
  'use strict';
  const U = window.T4V2, W = window.T4Work, M = window.T4Models, D = window.T4Data, R = window.T4Records;
  const e = U.esc, a = U.attr;
  const VIEWS = [
    { id: 'overview', label: 'Meu dia', subtitle: 'Empregadores, compromissos e decisões em um só lugar.', icon: 'dashboard' },
    { id: 'employers', label: 'Empregadores', subtitle: 'Relacionamento, vagas, talentos e histórico de cada empresa.', icon: 'building' },
    { id: 'pipeline', label: 'Seleções', subtitle: 'Cada linha representa Talento + empregador + vaga + etapa.', icon: 'columns' },
    { id: 'opportunities', label: 'Oportunidades', subtitle: 'Demanda real e requisitos de cada oportunidade.', icon: 'briefcase' },
    { id: 'calendar', label: 'Agenda', subtitle: 'Planejamento, reuniões e tarefas com data definida.', icon: 'calendar' },
    { id: 'planning', label: 'Planejamento mensal', subtitle: 'Atividades por empregador, período e responsável.', icon: 'list', primary: false },
    { id: 'meetings', label: 'Reuniões e decisões', subtitle: 'Pauta, decisões, pendências e próximos passos.', icon: 'people', primary: false },
    { id: 'operations', label: 'PO operacional', subtitle: 'Tarefas da equipe e métricas do mês.', icon: 'activity', primary: false },
    { id: 'summary', label: 'Resumo geral', subtitle: 'Leitura consolidada das atividades e do histórico.', icon: 'history', primary: false },
    { id: 'history', label: 'Acervo anterior', subtitle: 'Consulta protegida das informações anteriores à V2.', icon: 'archive', primary: false }
  ];
  const app = U.mount({ module: 'organization', moduleLabel: 'Organizacional', views: VIEWS, defaultView: 'overview' });
  const state = { talents: [], employers: [], openings: [], selections: { rows: [], modern: false }, activities: [], plans: [], meetings: [], summaries: [], replacements: [], tasks: [], metrics: [], query: '', employer: '', month: '', status: '', employerScope: 'active', employerClassification: 'all', employerDisplay: 'list', selectionDisplay: 'list', selectionShowClosed: false, opportunityScope: 'open', calendar: M.today().slice(0, 7), loaded: false, archive: null };
  const operationalKeys = ['plans', 'meetings', 'summaries', 'replacements', 'tasks', 'metrics'];
  const labels = { plans: 'Planejamento mensal', meetings: 'Reuniões', summaries: 'Resumos manuais', replacements: 'Reposições', tasks: 'Tarefas operacionais', metrics: 'Métricas' };
  const sources = {
    talents: { label: 'Talentos', load: () => D.loadCandidates({ activeOnly: false }) },
    employers: { label: 'Empregadores', load: () => D.loadEmployers({ activeOnly: false }) },
    openings: { label: 'Vagas', load: () => D.loadOpenings() },
    selections: { label: 'Seleções e vínculos anteriores', load: () => D.loadMatches() },
    activities: { label: 'Agenda integrada', load: () => D.loadActivities() },
    ...Object.fromEntries(operationalKeys.map((key) => [key, { label: labels[key], load: () => D.optionalAll(D.TABLES[key], '*', (q) => q.is('deleted_at', null)) }]))
  };
  const load = W.loader(app, state, sources, render);
  const employerOf = (r) => W.find(state.employers, r.employer_id)?.nome || r.employer_name_snapshot || r.group_name || 'Talents 4 · interno';
  const values = (value) => Array.isArray(value) ? value.filter(M.present).map(String) : M.present(value) ? [String(value)] : [];
  const firstValue = (value) => values(value)[0] || '';
  const matches = (value, selected) => { const wanted = values(selected); return !wanted.length || wanted.some((item) => M.same(item, value) || M.norm(item) === M.norm(value)); };
  const scoped = (r) => matches(r.employer_id, state.employer) || (!r.employer_id && values(state.employer).some((id) => M.norm(r.employer_name_snapshot) === M.norm(W.find(state.employers, id)?.nome)));
  const matchQuery = (r) => !state.query || M.norm(Object.values(r).filter((v) => typeof v !== 'object').join(' ')).includes(M.norm(state.query));
  const closedStatus = (value) => /^(conclu|cancel|arquiv|inativ|removid|exclu|encerr|rejeit|desist)/i.test(M.norm(value));
  // Operational registers start clean: a negative lifecycle only appears
  // after the user selects that status (or asks for the archive view).
  const filtered = (rows, dateField = '') => rows.filter((r) => scoped(r) && matches(r.month_ref || String(r[dateField] || '').slice(0, 7), state.month) && (values(state.status).length ? matches(r.status, state.status) : !closedStatus(r.status)) && matchQuery(r));
  const actions = (row, kind) => D.canEdit() ? W.button('Editar', `edit-${kind}`, row.id, { className: 'sm ghost', icon: 'edit' }) : '';
  const months = () => [...new Set([M.today().slice(0, 7), ...operationalKeys.flatMap((key) => state[key].map((r) => r.month_ref || String(r.scheduled_at || '').slice(0, 7)))])].filter(Boolean).sort().reverse();
  const filterLabels = { employer: 'Empregador', month: 'Período', status: 'Situação' };
  const monthLabel = (value) => { const d = new Date(`${value}-01T12:00:00`); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); };
  const filterValueLabel = (key, value) => key === 'employer' ? R.employerName(state, value) : key === 'month' ? monthLabel(value) : value;
  const toolbar = (rows = [], opts = {}) => {
    const keys = ['employer', ...(opts.noMonth ? [] : ['month']), ...(opts.noStatus ? [] : ['status'])];
    return `<div class="t4-toolbar">${W.multiFilter('employer', 'Empregadores', R.choices(state.employers, 'nome'), state.employer)}${opts.noMonth ? '' : W.multiFilter('month', 'Períodos', months(), state.month)}${opts.noStatus ? '' : W.multiFilter('status', 'Situações', W.unique(rows, 'status'), state.status)}<span class="t4-toolbar-spacer"></span>${W.button('Limpar', 'clear', '', { className: 'ghost sm' })}${W.button('Atualizar', 'reload', '', { className: 'sm', icon: 'refresh' })}</div>${W.activeFiltersBar(state, keys, filterLabels, filterValueLabel)}`;
  };
  // A navegação oficial é a lateral. A antiga barra de “visões salvas” duplicava
  // os mesmos destinos, ocupava espaço e dava a impressão de abas concorrentes.
  // A API permanece compatível para links antigos, mas não renderiza uma segunda
  // navegação em cada tela.
  const workViews = () => '';
  const available = (key) => state.sources[key]?.available === true;
  const can = (key) => D.canEdit() && available(key) && (key !== 'selections' || state.selections.modern);
  function events() {
    return [
      ...state.plans.map((r) => ({ ...r, title: r.activity_label, due: r.end_date || r.start_date, start: r.start_date, owner: r.responsavel, type: 'Planejamento', action: 'edit-plan', detail: r.obs })),
      ...state.meetings.map((r) => ({ ...r, title: r.topic || r.title, due: r.scheduled_at, owner: r.owner_name, type: 'Reunião', action: 'meeting-detail', detail: r.decision_summary, next: r.next_action })),
      ...state.tasks.map((r) => ({ ...r, due: r.due_date, owner: r.owner_user_key || r.assigned_user_key, type: 'PO operacional', action: 'edit-task', detail: r.description, next: r.notes })),
      ...state.activities.map((r) => ({ ...r, due: r.due_at, owner: r.owner_username, type: r.contact_followup_id ? 'Contatos' : 'Agenda integrada', action: 'edit-activity', detail: r.notes, next: r.outcome }))
    ].sort((x, y) => String(x.due || '9999').localeCompare(String(y.due || '9999')));
  }
  function eventTable(rows, id) {
    return W.table({ id, rows, columns: [
      { key: 'title', label: 'Atividade / assunto', required: true, render: (r) => `<button type="button" class="t4-row-link" data-action="${a(r.action)}" data-id="${a(r.id)}">${e(r.title || 'Sem título')}</button><span class="t4-cell-secondary">${e(r.type)}</span>` },
      { key: 'employer', label: 'Empregador / escopo', value: employerOf, render: (r) => e(employerOf(r)) },
      { key: 'due', label: 'Prazo', render: (r) => `${e(U.formatDate(r.due))}${M.overdue(r.due, r.status) ? U.badge('Vencido', 'danger') : ''}` },
      { key: 'owner', label: 'Responsável' }, { key: 'status', label: 'Situação', render: (r) => W.status(r.status) },
      { key: 'detail', label: 'Contexto / decisão', render: (r) => `<span class="t4-clamp-3">${e(r.detail || '—')}</span>` },
      { key: 'next', label: 'Próxima ação / resultado', render: (r) => `<span class="t4-clamp-3">${e(r.next || '—')}</span>` }
    ] });
  }
  function render() {
    if (!state.loaded) return;
    app.setCounts({ employers: state.employers.filter((r) => M.activeRecord(r)).length, pipeline: state.selections.rows.filter((r) => M.selectionBucket(r) !== 'closed').length, meetings: state.meetings.length, operations: state.tasks.filter((r) => M.isOpen(r.status)).length });
    app.setSearchHandler((q) => { state.query = q; render(); }, 'Buscar nesta área…');
    const primary = { overview: ['Nova atividade', () => R.editActivity(state, null, {}, load), 'activities'], employers: ['Novo empregador', () => editEmployer(), 'employers'], opportunities: ['Nova vaga', () => editOpening(), 'openings'], pipeline: ['Nova seleção', () => R.editSelection(state, null, {}, load), 'selections'], planning: ['Nova atividade mensal', () => editPlan(), 'plans'], calendar: ['Nova reunião', () => editMeeting(), 'meetings'], meetings: ['Nova reunião', () => editMeeting(), 'meetings'], operations: ['Nova tarefa', () => editTask(), 'tasks'], summary: ['Adicionar resumo', () => editSummary(), 'summaries'] }[app.view];
    app.setPrimaryAction(primary?.[0], primary && can(primary[2]) ? primary[1] : null);
    const html = ({ overview, employers: employersView, opportunities: opportunitiesView, pipeline: pipelineView, planning: planningView, calendar: calendarView, meetings: meetingsView, operations: operationsView, summary: summaryView, history: historyView }[app.view] || overview)();
    app.pageRoot.innerHTML = W.sourceAlerts(state) + html;
    U.animateCounters(app.pageRoot);
  }
  function overview() {
    const activeEmployers = state.employers.filter((r) => M.activeRecord(r));
    const pending = events().filter((r) => scoped(r) && matchQuery(r) && M.isOpen(r.status));
    const late = pending.filter((r) => M.overdue(r.due, r.status));
    const soon = pending.filter((r) => r.due && !M.overdue(r.due, r.status));
    return workViews('overview') + `<div class="t4-work-intro"><div><span class="t4-overline">OPERAÇÃO E RELACIONAMENTO</span><h2>O próximo passo de cada parceria.</h2><p>Acompanhe decisões, avance seleções e mantenha o contexto da equipe.</p></div>${W.button('Ver calendário', 'go', 'calendar', { icon: 'calendar' })}</div>
      <section class="t4-kpi-grid">${U.kpi('Empregadores ativos', available('employers') ? activeEmployers.length : '—', 'Base de relacionamento')}${U.kpi('Vagas abertas', available('openings') ? state.openings.filter((r) => M.isOpen(r.status) && !/fechad/i.test(r.status)).reduce((n, r) => n + (Number(r.quantity) || 0), 0) : '—', 'Quantidade de posições')}${U.kpi('Ações em aberto', pending.length, 'Nas fontes carregadas')}${U.kpi('Prazos vencidos', late.length, 'Revisar com a equipe', late.length ? 'risk' : 'good')}</section>
      ${state.selections.rows.length ? stagePulse(state.selections.rows.filter((r) => M.selectionBucket(r) !== 'closed')) : ''}
      ${W.section('Precisa de atenção', eventTable(late, 'org-late'), U.badge(late.length, late.length ? 'danger' : 'success'))}
      ${W.section('A seguir', eventTable(soon, 'org-soon'), W.button('Agenda completa', 'go', 'calendar', { className: 'ghost sm' }))}
      ${W.section('Parcerias em foco', employerCards(activeEmployers.filter(matchQuery).slice(0, 6)), W.button('Todos os empregadores', 'go', 'employers', { className: 'sm' }))}`;
  }
  function employerCards(rows) {
    return `<div class="t4-cards-grid">${rows.map((r) => {
      const selections = state.selections.rows.filter((s) => M.same(s.employer_id, r.id) && M.selectionBucket(s) !== 'closed');
      const jobs = state.openings.filter((s) => M.same(s.employer_id, r.id) && !/fechad|cancel/i.test(s.status || ''));
      const pending = events().filter((s) => (M.same(s.employer_id, r.id) || (!s.employer_id && M.norm(s.employer_name_snapshot) === M.norm(r.nome))) && M.isOpen(s.status));
      const employerColor = window.T4Modern?.color(r) || '#002a4a';
      const active = M.activeRecord(r);
      return `<article class="t4-company-card ${active ? '' : 'v25-negative-surface'}" style="--employer-color:${a(employerColor)}"><div class="t4-company-head"><span class="t4-company-avatar">${U.icon('building')}</span>${W.status(active ? (r.status || 'Ativo') : 'Arquivado')}</div><button class="t4-card-title" data-action="employer-detail" data-id="${a(r.id)}">${e(r.nome)}</button><p class="t4-card-location">${e([r.cidade, r.pais].filter(Boolean).join(' · ') || 'Localização não informada')}</p>${R.employerClassificationHtml(r)}<p class="t4-clamp-3">${e(r.descricao_resumida || r.descricao_operacional || 'Adicione o contexto desta parceria.')}</p><div class="t4-card-stats"><span><strong>${jobs.length}</strong> oportunidades</span><span><strong>${new Set(selections.map((s) => s.talent_id)).size}</strong> talentos</span><span><strong>${pending.length}</strong> ações</span></div><footer><span>${e(r.responsavel_interno || 'Sem responsável')}</span>${W.button('Abrir dossiê', 'employer-detail', r.id, { className: 'sm ghost', icon: 'chevron' })}</footer></article>`;
    }).join('') || U.emptyState('Nenhum empregador neste filtro', 'Limpe os filtros para conferir todos os registros.')}</div>`;
  }
  function employersView() {
    const scope = state.employerScope || 'active';
    const classification = state.employerClassification || 'all';
    const employerPriority = (row) => {
      if (R.employerClassificationMatches(row, 'partner')) return 0;
      if (R.employerClassificationMatches(row, 'nectanet')) return 1;
      if (R.employerClassificationMatches(row, 'general')) return 2;
      if (R.employerClassificationMatches(row, 'external')) return 3;
      return 4;
    };
    const rows = state.employers.filter((r) => {
      const isActive = M.activeRecord(r);
      if (scope === 'active' && !isActive) return false;
      if (scope === 'archived' && isActive) return false;
      return matches(r.id, state.employer) && matches(r.status || 'Ativo', state.status) && R.employerClassificationMatches(r, classification) && matchQuery(r);
    }).sort((left, right) => employerPriority(left) - employerPriority(right) || M.norm(left.nome).localeCompare(M.norm(right.nome), 'pt-BR'));
    const scopeCount = (id) => id === 'active' ? state.employers.filter((r) => M.activeRecord(r)).length : id === 'archived' ? state.employers.filter((r) => !M.activeRecord(r)).length : state.employers.length;
    const scopeBar = W.chips([{ id: 'active', label: 'Ativos', count: scopeCount('active'), icon: 'building' }, { id: 'all', label: 'Todos os registros', count: scopeCount('all'), icon: 'list' }, { id: 'archived', label: 'Arquivo', count: scopeCount('archived'), icon: 'archive' }], scope, 'employer-scope');
    const classificationOptions = [{ id: 'all', label: 'Todos', icon: 'list' }, { id: 'partner', label: 'Parceiras diretas', icon: 'check' }, { id: 'nectanet', label: 'Apresentadas pela NectaNet', icon: 'arrow' }, { id: 'general', label: 'Empresas gerais', icon: 'building' }, { id: 'pending', label: 'Parceria a confirmar', icon: 'warning' }];
    const classificationCount = (id) => state.employers.filter((r) => (scope === 'active' ? M.activeRecord(r) : scope === 'archived' ? !M.activeRecord(r) : true) && R.employerClassificationMatches(r, id)).length;
    const classificationBar = `<div class="v25-classification-filter"><div><strong>Tipo de relação</strong><span>Escolha como a empresa deve ser lida na operação.</span></div>${W.chips(classificationOptions.map((item) => ({ ...item, count: item.id === 'all' ? scopeCount(scope === 'active' ? 'active' : scope === 'archived' ? 'archived' : 'all') : classificationCount(item.id) })), classification, 'employer-classification')}</div>`;
    const displayBar = W.chips([{ id: 'cards', label: 'Cartões', icon: 'grid' }, { id: 'list', label: 'Lista', icon: 'list' }], state.employerDisplay, 'employer-display');
    const helper = scope === 'active' ? 'A fila operacional mostra somente empregadores ativos. O arquivo fica disponível quando você precisar consultar histórico.' : scope === 'archived' ? 'Registros inativos ou arquivados ficam isolados aqui; não entram na fila operacional.' : 'Todos os registros, inclusive os arquivados. Use esta visão para auditoria, não para a operação diária.';
    const classificationHelp = 'Parceira Talents 4 só aparece após confirmação direta da equipe. “Apresentada pela NectaNet” identifica a origem do contato e não significa parceria direta. “Empresa geral” é um escopo separado.';
    const list = W.table({ id: 'employers', rows, columns: [
      { key: 'nome', label: 'Empregador', required: true, render: (r) => { const color = window.T4Modern?.color(r) || '#7890a4'; return `<div class="v25-employer-cell" style="--employer-color:${a(color)}"><i></i>${W.person(r.nome, r.area_atuacao || '', '', 'employer-detail', r.id)}</div>`; } },
      { key: 'cidade', label: 'Cidade' }, { key: 'contato_principal', label: 'Contato principal' }, { key: 'email_principal', label: 'E-mail' }, { key: 'responsavel_interno', label: 'Responsável' }, { key: 'status', label: 'Situação', render: (r) => W.status(M.activeRecord(r) ? (r.status || 'Ativo') : 'Arquivado') },
      { key: 'classification', label: 'Classificação', sort: false, render: (r) => R.employerClassificationHtml(r) },
      { key: 'edit', label: '', sort: false, render: (r) => actions(r, 'employer') }
    ] });
    return workViews('employers') + `<div class="v25-page-intro"><div><span class="mx-eyebrow">RELACIONAMENTO COM EMPRESAS</span><h2>Uma empresa por vez, contexto sempre visível.</h2><p>${e(helper)}</p></div><span class="v25-result-count">${rows.length} registro${rows.length === 1 ? '' : 's'}</span></div>` + scopeBar + classificationBar + `<p class="v25-classification-help">${e(classificationHelp)}</p>` + toolbar(state.employers, { noMonth: true }) + displayBar + (state.employerDisplay === 'cards' ? employerCards(rows) : list);
  }
  function planningView() {
    const rows = filtered(state.plans).sort((x, y) => employerOf(x).localeCompare(employerOf(y), 'pt-BR') || String(x.month_ref).localeCompare(String(y.month_ref)) || (x.order_index || 0) - (y.order_index || 0));
    const open = rows.filter((r) => M.isOpen(r.status)).length, withoutEmployer = rows.filter((r) => !r.employer_id && !r.employer_name_snapshot).length;
    const context = `<div class="v25-context-strip"><div><span class="mx-eyebrow">ORGANIZAÇÃO DO MÊS</span><strong>Defina o que será realizado e por quem.</strong><p>Planejamento mensal organiza entregas, período, responsável e empregador. A execução diária fica em PO operacional; reuniões e decisões ficam em sua própria área.</p></div><div class="v25-context-stats"><span><b>${rows.length}</b> atividades</span><span><b>${open}</b> em aberto</span><span><b>${withoutEmployer}</b> sem empregador</span></div></div>`;
    return context + toolbar(state.plans) + W.table({ id: 'planning', rows, groupBy: employerOf, columns: [
      { key: 'activity_label', label: 'Etapa / atividade', required: true, render: (r) => `<button class="t4-row-link" data-action="edit-plan" data-id="${a(r.id)}">${e(r.activity_label)}</button>` },
      { key: 'month_ref', label: 'Período' }, { key: 'responsavel', label: 'Responsável' }, { key: 'status', label: 'Situação', render: (r) => W.status(r.status) },
      { key: 'obs', label: 'Observação / próxima ação', render: (r) => `<span class="t4-clamp-3">${e(r.obs || '—')}</span>` },
      { key: 'start_date', label: 'Início', render: (r) => e(U.formatDate(r.start_date)) }, { key: 'end_date', label: 'Fim', render: (r) => e(U.formatDate(r.end_date)) }, { key: 'edit', label: '', sort: false, render: (r) => actions(r, 'plan') }
    ] });
  }
  function meetingsView() {
    return toolbar(state.meetings) + W.table({ id: 'meetings', rows: filtered(state.meetings, 'scheduled_at').sort((x, y) => String(y.scheduled_at).localeCompare(String(x.scheduled_at))), columns: [
      { key: 'topic', label: 'Reunião / pauta', required: true, render: (r) => `<button class="t4-row-link" data-action="meeting-detail" data-id="${a(r.id)}">${e(r.topic || r.title)}</button><span class="t4-cell-secondary">${e(employerOf(r))}</span>` },
      { key: 'scheduled_at', label: 'Data', render: (r) => e(U.formatDate(r.scheduled_at, true)) }, { key: 'week_label', label: 'Semana' },
      { key: 'decision_summary', label: 'O que foi decidido', render: (r) => `<span class="t4-clamp-3">${e(r.decision_summary || '—')}</span>` },
      { key: 'pending_items', label: 'Pendências', render: (r) => `<span class="t4-clamp-3">${e(r.pending_items || '—')}</span>` }, { key: 'next_action', label: 'Próxima ação' }, { key: 'owner_name', label: 'Responsável' }, { key: 'status', label: 'Situação', render: (r) => W.status(r.status) }
    ] });
  }
  function meetingDetail(row) {
    if (!row) return;
    U.openDrawer({ title: row.topic || row.title || 'Reunião', subtitle: `${employerOf(row)} · ${U.formatDate(row.scheduled_at, true)}`,
      actions: actions(row, 'meeting') + (can('tasks') ? W.button('Criar tarefa a partir da decisão', 'meeting-task', row.id, { className: 'primary', icon: 'plus' }) : ''),
      body: `<div class="t4-detail-grid">${U.field('Semana', row.week_label)}${U.field('Responsável', row.owner_name)}${U.field('Situação', row.status)}${U.field('Escopo', row.meeting_scope)}</div>${[['Decisões', row.decision_summary], ['Itens resolvidos', row.resolved_items], ['Pendências', row.pending_items], ['Próxima ação', row.next_action], ['Observações', row.notes]].map(([label, value]) => W.section(label, `<p class="t4-preserve">${e(value || 'Não informado')}</p>`)).join('')}` });
  }
  function operationsView() {
    const tasks = filtered(state.tasks), metrics = state.metrics.filter((r) => scoped(r) && (!state.month || r.month_ref === state.month) && matchQuery(r));
    const open = tasks.filter((r) => M.isOpen(r.status)).length, overdue = tasks.filter((r) => M.overdue(r.due_date, r.status)).length, done = tasks.filter((r) => /pronto|conclu/i.test(r.status)).length;
    const taskIntro = `<div class="v25-context-strip v25-operations-intro"><div><span class="mx-eyebrow">EXECUÇÃO DA EQUIPE</span><strong>Ações com responsável, prazo e resultado.</strong><p>Esta é a fila de trabalho do PO operacional. Registre uma ação por linha, acompanhe o prazo e conclua quando houver entrega. Metas e resultados ficam abaixo, em Métricas do período.</p></div><div class="v25-context-stats"><span><b>${tasks.length}</b> no recorte</span><span><b>${open}</b> em aberto</span><span class="${overdue ? 'risk' : ''}"><b>${overdue}</b> vencidas</span><span><b>${done}</b> concluídas</span></div></div>`;
    const taskActions = (r) => `<div class="t4-chip-row">${D.canEdit() && M.isOpen(r.status) ? W.button('Concluir', 'finish-task', r.id, { className: 'sm', icon: 'check' }) : ''}${actions(r, 'task')}</div>`;
    const taskTable = W.table({ id: 'tasks', rows: tasks, columns: [
      { key: 'title', label: 'Tarefa / entrega', required: true, render: (r) => `<button class="t4-row-link" data-action="edit-task" data-id="${a(r.id)}">${e(r.title || 'Tarefa sem título')}</button><span class="t4-cell-secondary t4-clamp-3">${e(r.description || r.notes || 'Sem descrição ou resultado registrado.')}</span>` },
      { key: 'due_date', label: 'Prazo', render: (r) => `${e(U.formatDate(r.due_date))}${M.overdue(r.due_date, r.status) ? U.badge('Vencida', 'danger') : ''}` }, { key: 'priority', label: 'Prioridade', render: (r) => U.badge(r.priority || 'Normal', /alta|crit/i.test(r.priority) ? 'danger' : '') }, { key: 'status', label: 'Situação', render: (r) => W.status(r.status) }, { key: 'owner_user_key', label: 'Responsável', render: (r) => e(r.owner_user_key || r.assigned_user_key || '—') }, { key: 'context_type', label: 'Empregador / escopo', render: (r) => W.stack(employerOf(r), r.team_scope) }, { key: 'edit', label: '', sort: false, render: taskActions }
    ] });
    const metricBody = `<div class="t4-kpi-grid">${U.kpi('Tarefas no recorte', tasks.length, 'Fila exibida')}${U.kpi('Em aberto', open, 'Ações da equipe')}${U.kpi('Vencidas', overdue, 'Prazos a revisar', 'warn')}${U.kpi('Concluídas', done, 'Entregas registradas', 'good')}</div>${W.table({ id: 'metrics', rows: metrics, columns: [
      { key: 'metric_label', label: 'Métrica', required: true }, { key: 'month_ref', label: 'Mês' }, { key: 'target_value', label: 'Meta' }, { key: 'actual_value', label: 'Realizado' }, { key: 'owner_user_key', label: 'Responsável' }, { key: 'notes', label: 'Leitura / contexto' }, { key: 'edit', label: '', sort: false, render: (r) => actions(r, 'metric') }
    ] })}`;
    return toolbar(state.tasks) + taskIntro + W.section('Tarefas operacionais', taskTable, can('tasks') ? W.button('Nova tarefa', 'new-task', '', { className: 'primary sm', icon: 'plus' }) : '', 'Ações executáveis da equipe. Ordene por prazo, prioridade ou situação para decidir o próximo passo.') +
      W.section('Métricas do período', metricBody, can('metrics') ? W.button('Nova métrica', 'new-metric', '', { className: 'sm', icon: 'plus' }) : '', 'Metas e resultados para leitura do período; não substituem as tarefas e não são filtrados pela situação da fila.');
  }
  function summaryView() {
    const manual = state.summaries.map((r) => ({ ...r, title: r.what_was_done, detail: r.result_summary, next: r.next_action, due: r.period_end, owner: r.owner_name, type: 'Resumo manual', action: 'edit-summary' }));
    const rows = filtered([...events(), ...manual], 'due');
    return toolbar(rows) + W.note('Esta visão reúne registros das fontes existentes. Planejamento e reuniões continuam independentes; não são copiados nem regravados para gerar o resumo.') + eventTable(rows, 'summary');
  }
  function calendarView() {
    const [year, month] = state.calendar.split('-').map(Number);
    const first = new Date(year, month - 1, 1), offset = (first.getDay() + 6) % 7;
    const start = new Date(year, month - 1, 1 - offset);
    const rows = events().filter((r) => scoped(r) && matchQuery(r) && (values(state.status).length ? matches(r.status, state.status) : !closedStatus(r.status)));
    const days = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayEvents = rows.filter((r) => M.dateOnly(r.due) === key);
      return `<div class="t4-calendar-day ${d.getMonth() === month - 1 ? '' : 'outside'} ${key === M.today() ? 'today' : ''}"><div class="t4-calendar-date">${d.getDate()}</div>${dayEvents.map((r) => `<button class="t4-calendar-event ${/Reunião/.test(r.type) ? 'meeting' : ''}" data-action="${a(r.action)}" data-id="${a(r.id)}" title="${a(employerOf(r) + ' · ' + r.title)}"><small>${e(r.type)}</small>${e(r.title)}</button>`).join('')}</div>`;
    });
    return toolbar(rows, { noMonth: true }) + `<div class="t4-calendar-heading"><div>${W.button('Anterior', 'month-prev', '', { className: 'sm' })}<h2>${e(first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</h2>${W.button('Próximo', 'month-next', '', { className: 'sm' })}</div>${W.button('Hoje', 'month-today', '', { className: 'sm' })}</div><div class="t4-calendar"><div class="t4-calendar-weekdays">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => `<span>${d}</span>`).join('')}</div><div class="t4-calendar-grid">${days.join('')}</div></div>${W.section('Sem prazo definido', eventTable(rows.filter((r) => !r.due && M.isOpen(r.status)), 'no-date'))}`;
  }
  function opportunitiesView() {
    const scope = state.opportunityScope || 'open';
    const isClosed = (r) => /fechad|cancel|arquiv|removid|encerr/i.test(M.norm(r.status || '')) || !!r.deleted_at;
    const rows = state.openings.filter((r) => {
      if (scope === 'open' && isClosed(r)) return false;
      if (scope === 'closed' && !isClosed(r)) return false;
      return scoped(r) && matchQuery(r) && matches(r.status, state.status);
    });
    const count = (id) => state.openings.filter((r) => id === 'open' ? !isClosed(r) : id === 'closed' ? isClosed(r) : true).length;
    const scopeBar = W.chips([{ id: 'open', label: 'Abertas', count: count('open'), icon: 'briefcase' }, { id: 'all', label: 'Todas', count: count('all'), icon: 'list' }, { id: 'closed', label: 'Encerradas', count: count('closed'), icon: 'archive' }], scope, 'opportunity-scope');
    return workViews('opportunities') + `<div class="v25-page-intro"><div><span class="mx-eyebrow">MERCADO DE OPORTUNIDADES</span><h2>Oportunidades separadas das seleções.</h2><p>Uma vaga pode receber vários Talentos; a etapa de cada vínculo fica em Seleções.</p></div><span class="v25-result-count">${rows.length} vaga${rows.length === 1 ? '' : 's'}</span></div>` + scopeBar + toolbar(state.openings, { noMonth: true }) + opportunityRegister(rows, scope);
  }
  function pipelineView() {
    const rows = state.selections.rows.filter((r) => scoped(r) && matchQuery({ ...r, talent: R.talentName(state, r.talent_id), employer: employerOf(r) }) && matches(r.stage, state.status));
    const activeRows = rows.filter((r) => M.selectionBucket(r) !== 'closed'), closedRows = rows.filter((r) => M.selectionBucket(r) === 'closed');
    const display = state.selectionDisplay || 'list';
    const closedSection = closedRows.length ? (state.selectionShowClosed ? W.section('Encerrados e histórico', R.selectionTable(state, closedRows, 'org-selection-closed')) : `<div class="v25-archive-callout"><div><strong>${closedRows.length} relação${closedRows.length === 1 ? '' : 'ões'} encerrada${closedRows.length === 1 ? '' : 's'} não aparece${closedRows.length === 1 ? '' : 'm'} na fila.</strong><span>O histórico continua preservado e só é exibido quando você solicitar.</span></div>${W.button('Mostrar encerrados', 'selection-archive', '', { className: 'ghost sm', icon: 'archive' })}</div>`) : '';
    const current = display === 'cards' ? R.selectionBoard(state, activeRows) : R.selectionTable(state, activeRows, 'org-selection-active');
    return workViews('pipeline') + `<div class="v25-page-intro"><div><span class="mx-eyebrow">CENTRO DE SELEÇÕES</span><h2>Uma relação por linha, sem quadro obrigatório.</h2><p>Seleção = Talento + empregador + vaga + etapa. O cadastro do Talento e o dossiê do empregador continuam sendo únicos.</p></div><span class="v25-result-count">${activeRows.length} ativa${activeRows.length === 1 ? '' : 's'}</span></div>` + W.chips([{ id: 'list', label: 'Lista analítica', icon: 'list' }, { id: 'cards', label: 'Quadro opcional', icon: 'columns' }], display, 'selection-display') + toolbar(state.selections.rows.map((r) => ({ status: r.stage })), { noMonth: true }) + stagePulse(activeRows) + current + closedSection +
      W.section('Reposições', replacementTable(state.replacements.filter(scoped)), can('replacements') ? W.button('Nova reposição', 'new-replacement', '', { className: 'sm', icon: 'plus' }) : '');
  }
  function selectionRegister(rows, closed = false) {
    if (!rows.length) return `<div class="mx-empty"><strong>${closed ? 'Nenhuma seleção encerrada neste filtro.' : 'Nenhuma seleção neste filtro.'}</strong><span>Use filtros diferentes ou crie uma relação a partir de uma vaga válida.</span></div>`;
    const groups = new Map();
    rows.forEach((r) => { const key = String(r.employer_id || 'internal'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); });
    const active = rows.filter((r) => !closed && M.isOpen(r.status)).length, overdue = rows.filter((r) => M.overdue(r.next_action_at, r.status)).length;
    const metrics = `<div class="mx-metric-strip"><div><span>Relações</span><strong>${rows.length}</strong></div><div><span>Empregadores</span><strong>${groups.size}</strong></div><div><span>Próximas ações</span><strong>${active}</strong></div><div class="${overdue ? 'risk' : ''}"><span>Vencidas</span><strong>${overdue}</strong></div></div>`;
    const blocks = [...groups.entries()].map(([key, items]) => { const emp = W.find(state.employers, key) || { id:key, nome:employerOf(items[0]) }, color = window.T4Modern?.color(emp) || '#7890a4';
      return `<section class="mx-register-group" style="--employer-color:${a(color)}"><header><div>${window.T4Modern?.employer ? window.T4Modern.employer(emp) : `<strong>${e(emp.nome)}</strong>`}<span>${items.length} relação(ões) · ${items.filter((r) => M.selectionBucket(r) === 'hired').length} contratação(ões)</span></div><button type="button" class="t4-btn ghost sm" data-action="go-employer" data-id="${a(key)}">Abrir empregador</button></header><div class="mx-register-rows">${items.map((r) => { const talent = W.find(state.talents, r.talent_id), opening = W.find(state.openings, r.opening_id); return `<article class="mx-register-row"><div class="mx-register-person"><span class="t4-avatar sm">${e(U.initials(talent?.nome_completo || R.talentName(state,r.talent_id)))}</span><div><button class="t4-row-link" data-action="selection-detail" data-id="${a(r.key)}">${e(R.talentName(state,r.talent_id))}</button><span>${e(talent?.profissao_principal || talent?.area_profissional || 'Área não informada')}</span></div></div><div><strong>${e(opening?.title || 'Vínculo geral anterior')}</strong><span>${e([opening?.location, talent?.nivel_alemao ? `Alemão ${talent.nivel_alemao}` : ''].filter(Boolean).join(' · ') || 'Detalhes da vaga não informados')}</span></div><div>${W.status(r.stage)}<span class="mx-register-meta">${e(r.viability || 'Viabilidade não avaliada')}</span></div><div class="mx-next"><strong>${e(r.next_action || 'Definir próxima ação')}</strong><span>${e([r.next_action_at ? U.formatDate(r.next_action_at) : 'Sem prazo', r.owner_username || 'Sem responsável'].join(' · '))}</span></div><div class="mx-register-actions">${D.canEdit() ? W.button('Editar','edit-selection',r.key,{className:'ghost sm',icon:'edit'}) : ''}${W.button('Detalhes','selection-detail',r.key,{className:'sm'})}</div></article>`; }).join('')}</div></section>`;
    }).join('');
    return metrics + `<div class="mx-register" aria-label="Registro de seleções">${blocks}</div>`;
  }
  function stagePulse(rows) {
    const stages = ['Mapeado', 'Em análise', 'Apresentado', 'Entrevista', 'Proposta', 'Contratado'];
    const counts = stages.map((stage) => ({ stage, count: rows.filter((r) => M.norm(r.stage) === M.norm(stage)).length })), max = Math.max(1, ...counts.map((x) => x.count));
    return `<section class="mx-pulse" aria-label="Distribuição das seleções por etapa"><header><div><span class="mx-eyebrow">LEITURA RÁPIDA</span><h3>Distribuição por etapa</h3></div><span class="mx-meta">${rows.length} relações ativas</span></header><div class="mx-pulse-grid">${counts.map((x) => `<div><div class="mx-pulse-label"><span>${e(x.stage)}</span><strong>${x.count}</strong></div><div class="mx-pulse-track"><i style="width:${Math.round(x.count / max * 100)}%"></i></div></div>`).join('')}</div></section>`;
  }
  function opportunityRegister(rows, scope = 'open') {
    if (!rows.length) return `<div class="mx-empty"><strong>Nenhuma oportunidade encontrada.</strong><span>Cadastre vagas no Organizacional ou limpe os filtros.</span></div>`;
    return W.table({ id: 'org-opportunities', rows, columns: [
      { key: 'title', label: 'Oportunidade', required: true, render: (r) => `<button class="t4-row-link" data-action="opening-detail" data-id="${a(r.id)}">${e(r.title || 'Oportunidade sem nome')}</button><span class="t4-cell-secondary">${e(r.area || 'Área não informada')}</span>` },
      { key: 'employer_id', label: 'Empregador', value: employerOf, render: (r) => { const emp = W.find(state.employers, r.employer_id) || { id: r.employer_id, nome: employerOf(r) }; const color = window.T4Modern?.color(emp) || '#7890a4'; return `<div class="v25-employer-cell" style="--employer-color:${a(color)}"><i></i>${W.person(emp.nome, '', '', 'employer-detail', r.employer_id)}</div>`; } },
      { key: 'quantity', label: 'Posições', render: (r) => W.stack(r.quantity || 0, 'posição(ões)') },
      { key: 'location', label: 'Local' }, { key: 'language_requirement', label: 'Idioma' },
      { key: 'status', label: 'Situação', render: (r) => W.status(r.status) },
      { key: 'linked', label: 'Talentos vinculados', value: (r) => state.selections.rows.filter((s) => M.same(s.opening_id, r.id) && (scope === 'all' || scope === 'open' && M.selectionBucket(s) !== 'closed' || scope === 'closed' && M.selectionBucket(s) === 'closed')).length, render: (r) => { const linked = state.selections.rows.filter((s) => M.same(s.opening_id, r.id) && (scope === 'all' || scope === 'open' && M.selectionBucket(s) !== 'closed' || scope === 'closed' && M.selectionBucket(s) === 'closed')); return W.stack(linked.length, linked.length === 1 ? 'talento' : 'talentos'); } },
      { key: 'actions', label: '', sort: false, render: (r) => `<div class="t4-chip-row">${actions(r, 'opening')}${W.button('Dossiê', 'opening-detail', r.id, { className: 'sm' })}</div>` }
    ], empty: 'Cadastre uma vaga ou ajuste os filtros.' });
  }
  function replacementTable(rows) {
    return W.table({ id: 'replacements', rows, columns: [
      { key: 'profile_needed', label: 'Perfil procurado', required: true }, { key: 'employer', label: 'Empregador', value: employerOf, render: (r) => e(employerOf(r)) }, { key: 'replaces_candidate_name_snapshot', label: 'Substitui' }, { key: 'priority', label: 'Prioridade' }, { key: 'search_status', label: 'Situação', render: (r) => W.status(r.search_status) }, { key: 'edit', label: '', sort: false, render: (r) => actions(r, 'replacement') }
    ] });
  }
  function employerDetail(row) {
    if (!row) return;
    const id = row.id, relationships = state.selections.rows.filter((r) => M.same(r.employer_id, id)), select = relationships.filter((r) => M.selectionBucket(r) !== 'closed'), closedSelect = relationships.filter((r) => M.selectionBucket(r) === 'closed');
    const related = (r) => M.same(r.employer_id, id) || (!r.employer_id && M.norm(r.employer_name_snapshot) === M.norm(row.nome));
    U.openDrawer({ title: row.nome, subtitle: [row.area_atuacao, row.cidade, row.pais].filter(Boolean).join(' · '),
      actions: actions(row, 'employer') + W.link('Contatos vinculados', `./contatos.html?employer=${encodeURIComponent(id)}`, 'contact') + (can('openings') ? W.button('Nova vaga', 'new-opening-for', id, { className: 'primary sm', icon: 'plus' }) : ''),
      body: `${R.employerClassificationHtml(row)}<p class="v25-classification-help">Parceira Talents 4 exige confirmação direta. A origem “Apresentada pela NectaNet” é informativa e não altera a parceria nem a etapa de nenhuma seleção.</p><div class="t4-detail-grid">${U.field('Responsável', row.responsavel_interno)}${U.field('Situação', row.status)}${U.field('Contato principal', row.contato_principal)}${U.field('E-mail', row.email_principal)}${U.field('Telefone', row.telefone)}${U.field('Alemão mínimo', row.nivel_alemao_minimo)}</div>
        ${W.section('Contexto da parceria', `<p class="t4-preserve">${e(row.descricao_operacional || row.descricao_resumida || 'Não informado')}</p><div class="t4-detail-grid">${U.field('Áreas-foco', row.area_atuacao)}${U.field('Perfis buscados', row.perfis_buscados)}${U.field('Requisitos', row.requisitos_principais)}${U.field('Diferenciais', row.diferenciais_desejaveis)}</div>${W.external('Site / referência', row.site)}`)}
        ${W.section('Seleções em andamento', R.selectionTable(state, select, 'dossier-selections'))}${closedSelect.length ? W.section('Histórico de seleções encerradas', R.selectionTable(state, closedSelect, 'dossier-closed-selections'), U.badge(`${closedSelect.length} preservada(s)`, 'info')) : ''}
        ${W.section('Próximas ações e reuniões', eventTable(events().filter(related), 'dossier-events'))}
        ${W.section('Reposições', replacementTable(state.replacements.filter(related)))}
        ${W.section('Observações internas', `<p class="t4-preserve">${e(row.observacoes_internas || 'Não informadas')}</p>`)}
        ${W.note('Informações que existam somente no acervo anterior podem ser consultadas sem restaurar ou sobrescrever o banco.')}${W.button('Consultar acervo anterior', 'go', 'history', { className: 'sm', icon: 'history' })}${R.storedFields(row, [
          'id', 'nome', 'responsavel_interno', 'status', 'contato_principal', 'email_principal', 'telefone', 'nivel_alemao_minimo',
          'descricao_operacional', 'descricao_resumida', 'area_atuacao', 'perfis_buscados', 'requisitos_principais', 'diferenciais_desejaveis', 'site',
          'observacoes_internas',
          'presented_by_nectanet', 'source_channel', 'direct_talents4_partnership', 'partnership_status', 'company_scope', 'classification_confidence', 'classification_source', 'classification_notes'
        ])}` });
  }
  const EMPLOYER_CLASSIFICATION_EDIT_KEYS = ['company_scope', 'direct_talents4_partnership', 'partnership_status', 'classification_notes'];
  const employerClassificationSchemaReady = (row = null) => row
    ? EMPLOYER_CLASSIFICATION_EDIT_KEYS.every((key) => Object.prototype.hasOwnProperty.call(row, key))
    : state.employers.some((item) => EMPLOYER_CLASSIFICATION_EDIT_KEYS.every((key) => Object.prototype.hasOwnProperty.call(item, key)));
  const EMPLOYER_CLASSIFICATION_FIELDS = [
    { section: 'Relacionamento e classificação' },
    { name: 'company_scope', label: 'Tipo de relação', type: 'select', options: [{ value: 'GENERAL', label: 'Empresa geral' }, { value: 'NECTANET_PRESENTED', label: 'Apresentada pela NectaNet' }, { value: 'TALENTS4_PARTNER', label: 'Parceira Talents 4 · escopo' }, { value: 'EXTERNAL_BW', label: 'Externa · BW' }, { value: 'UNKNOWN', label: 'Não definido' }], help: 'Origem ou escopo comercial; não confirma parceria direta.' },
    { name: 'direct_talents4_partnership', label: 'Parceria direta Talents 4', type: 'select', options: [{ value: 'UNKNOWN', label: 'Não confirmada' }, { value: 'CONFIRMADA', label: 'Confirmada manualmente' }, { value: 'REJEITADA', label: 'Não é parceira direta' }], help: 'Só “Confirmada manualmente” exibe Parceira Talents 4.' },
    { name: 'partnership_status', label: 'Situação da parceria', type: 'select', options: [{ value: 'ACTIVE', label: 'Ativa' }, { value: 'PROSPECT', label: 'Em prospecção' }, { value: 'FORMER', label: 'Anterior' }, { value: 'PAUSED', label: 'Pausada' }, { value: 'UNKNOWN', label: 'Não definida' }] },
    { name: 'classification_notes', label: 'Justificativa / observação da classificação', type: 'textarea', wide: true }
  ];
  const EMPLOYER_FIELDS = [
    { name: 'nome', label: 'Nome do empregador', required: true, wide: true },
    ...R.fields([['area_atuacao', 'Áreas-foco'], ['subsetor', 'Subsetor'], ['cidade', 'Cidade'], ['pais', 'País'], ['contato_principal', 'Contato principal'], ['email_principal', 'E-mail', 'email'], ['telefone', 'Telefone'], ['site', 'Site / referência', 'url'], ['responsavel_interno', 'Responsável interno'], ['nivel_alemao_minimo', 'Alemão mínimo', 'select', R.LEVELS], ['descricao_resumida', 'Descrição da empresa', 'textarea'], ['descricao_operacional', 'Contexto operacional', 'textarea'], ['perfis_buscados', 'Perfis buscados', 'textarea'], ['requisitos_principais', 'Requisitos', 'textarea'], ['diferenciais_desejaveis', 'Diferenciais desejáveis', 'textarea'], ['observacoes_internas', 'Observações internas', 'textarea']]),
    { name: 'ativo', label: 'Empregador ativo', type: 'checkbox' }
  ];
  function editEmployer(row) {
    if (!D.canEdit()) return employerDetail(row);
    const classificationReady = employerClassificationSchemaReady(row);
    const classificationFields = EMPLOYER_CLASSIFICATION_FIELDS.map((field) => field.name && !classificationReady ? { ...field, readonly: true, help: 'Campos de classificação ainda não existem no Supabase. Aplique a migração aditiva e atualize a tela para poder definir este dado.' } : field);
    const data = row || { ativo: true, ...(classificationReady ? { company_scope: 'UNKNOWN', direct_talents4_partnership: 'UNKNOWN', partnership_status: 'UNKNOWN' } : {}) };
    return W.recordForm({ title: row ? 'Editar empregador' : 'Novo empregador', table: D.TABLES.employers, row: data,
      fields: [...(row ? EMPLOYER_FIELDS.filter((f) => f.name in row) : EMPLOYER_FIELDS.filter((f) => !['subsetor', 'perfis_buscados', 'requisitos_principais', 'diferenciais_desejaveis', 'observacoes_internas'].includes(f.name))), ...classificationFields],
      notice: `${classificationReady ? 'Classifique a relação com cuidado: origem NectaNet e parceria direta são dimensões diferentes.' : 'A classificação aparece como pendente porque as colunas correspondentes ainda não foram encontradas no Supabase. Nenhuma tentativa de gravação será feita nesses campos.'} Apenas a confirmação manual pode marcar uma parceira.`,
      prepare(v, changes) { if (!row) Object.assign(v, { nome_normalizado: M.norm(v.nome).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), tipo: 'empregador', status: 'ativo', ...(classificationReady ? { source_channel: 'UNKNOWN' } : {}) }); if ('nome' in changes) changes.nome_normalizado = M.norm(v.nome).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }, after: load });
  }
  function editOpening(row, employerId) {
    if (!D.canEdit()) return openingDetail(row);
    return W.recordForm({ title: row ? 'Editar vaga' : 'Nova vaga', table: D.TABLES.openings, row: row || { employer_id: employerId || firstValue(state.employer), quantity: 1, status: 'Aberta' }, fields: [
      { name: 'employer_id', label: 'Empregador', type: 'select', options: R.choices(state.employers, 'nome'), required: true }, { name: 'title', label: 'Nome da oportunidade', required: true },
      { name: 'quantity', label: 'Quantidade de posições', type: 'number', min: 1, required: true }, { name: 'status', label: 'Situação', type: 'select', options: ['Aberta', 'Em andamento', 'Pausada', 'Fechada', 'Cancelada'], required: true, placeholder: null },
      ...R.fields([['location', 'Local'], ['area', 'Área'], ['language_requirement', 'Idioma requerido'], ['recognition_requirement', 'Reconhecimento exigido'], ['external_url', 'Página da oportunidade', 'url'], ['source', 'Origem'], ['verified_at', 'Verificada em', 'datetime-local'], ['description', 'Descrição e requisitos', 'textarea']])
    ].filter((f) => !row || f.name in row), prepare(v) { if (!row) { v.order_index = 0; v.deleted_at = null; } }, after: load });
  }
  function openingDetail(row) {
    if (!row) return;
    const relationships = state.selections.rows.filter((r) => M.same(r.opening_id, row.id)), activeRelationships = relationships.filter((r) => M.selectionBucket(r) !== 'closed'), closedRelationships = relationships.filter((r) => M.selectionBucket(r) === 'closed');
    U.openDrawer({ title: row.title, subtitle: employerOf(row), actions: actions(row, 'opening') + (state.selections.modern && D.canEdit() ? W.button('Vincular talento', 'selection-for-opening', row.id, { className: 'primary sm', icon: 'plus' }) : ''), body: `<div class="t4-detail-grid">${['quantity', 'status', 'location', 'area', 'language_requirement', 'recognition_requirement', 'source', 'verified_at'].map((key) => U.field({ quantity: 'Posições', status: 'Situação', location: 'Local', area: 'Área', language_requirement: 'Idioma requerido', recognition_requirement: 'Reconhecimento', source: 'Origem', verified_at: 'Última verificação' }[key], row[key])).join('')}</div><p class="t4-preserve">${e(row.description || 'Descrição não informada')}</p>${W.external('Abrir referência', row.external_url)}${W.section('Talentos em andamento', R.selectionTable(state, activeRelationships, 'opening-selections'))}${closedRelationships.length ? W.section('Histórico encerrado', R.selectionTable(state, closedRelationships, 'opening-closed-selections'), U.badge(`${closedRelationships.length} preservada(s)`, 'info')) : ''}` });
  }
  function employerFields() { return [{ name: 'employer_id', label: 'Empregador (opcional para assuntos internos)', type: 'select', options: R.choices(state.employers, 'nome') }]; }
  function snapshotEmployer(v, changes, row) {
    if (!row || 'employer_id' in changes) {
      const name = W.find(state.employers, v.employer_id)?.nome || null;
      v.employer_name_snapshot = name; if (row) changes.employer_name_snapshot = name;
    }
  }
  const PLAN_STATUS = ['A fazer', 'Em andamento', 'Concluído', 'Bloqueado', 'Cancelado'];
  function readonlyDetail(row, title) { U.openDrawer({ title, body: R.storedFields(row || {}) }); }
  function editPlan(row) {
    if (!D.canEdit()) return readonlyDetail(row, 'Atividade mensal');
    return W.recordForm({ title: row ? 'Editar atividade mensal' : 'Nova atividade mensal', table: D.TABLES.plans, row: row || { month_ref: firstValue(state.month) || M.today().slice(0, 7), employer_id: firstValue(state.employer), status: 'A fazer', responsavel: D.profile.nome }, fields: [
      ...employerFields(), { name: 'month_ref', label: 'Mês', type: 'month', required: true }, { name: 'activity_label', label: 'Atividade', required: true, wide: true }, { name: 'responsavel', label: 'Responsável' }, { name: 'status', label: 'Situação', type: 'select', options: PLAN_STATUS, required: true, placeholder: null }, { name: 'start_date', label: 'Início', type: 'date' }, { name: 'end_date', label: 'Fim', type: 'date' }, { name: 'obs', label: 'Observação / próxima ação', type: 'textarea', wide: true }
    ], prepare(v, c) {
      if (v.start_date && v.end_date && v.end_date < v.start_date) throw new Error('A data final precisa ser igual ou posterior à inicial.');
      snapshotEmployer(v, c, row);
      if (!row) Object.assign(v, { activity_type: 'custom', activity_key: `manual_${D.uuid().slice(0, 8)}`, order_index: 0, deleted_at: null });
    }, after: load });
  }
  function editMeeting(row) {
    if (!D.canEdit()) return meetingDetail(row);
    return W.recordForm({ title: row ? 'Editar reunião' : 'Nova reunião', table: D.TABLES.meetings, row: row || { employer_id: firstValue(state.employer), month_ref: firstValue(state.month) || M.today().slice(0, 7), status: 'A fazer', owner_name: D.profile.nome }, fields: [
      { name: 'title', label: 'Título da reunião', required: true, wide: true }, ...employerFields(), { name: 'scheduled_at', label: 'Data e hora', type: 'datetime-local' }, { name: 'month_ref', label: 'Mês de referência', type: 'month' }, { name: 'week_label', label: 'Semana' }, { name: 'owner_name', label: 'Responsável' }, { name: 'status', label: 'Situação', type: 'select', options: PLAN_STATUS, required: true, placeholder: null },
      ...R.fields([['topic', 'Pauta', 'textarea'], ['decision_summary', 'O que foi decidido', 'textarea'], ['resolved_items', 'Itens resolvidos', 'textarea'], ['pending_items', 'Pendências', 'textarea'], ['next_action', 'Próxima ação', 'textarea'], ['notes', 'Observações', 'textarea']])
    ], prepare(v, c) { snapshotEmployer(v, c, row); if (!row || 'employer_id' in c) { v.meeting_scope = v.employer_id ? 'employer' : 'internal'; v.group_name = v.employer_id ? null : 'Talents 4'; if (row) Object.assign(c, { meeting_scope: v.meeting_scope, group_name: v.group_name }); } if (!row) v.deleted_at = null; }, after: load });
  }
  function editTask(row, context = {}) {
    if (!D.canEdit()) return readonlyDetail(row, 'Tarefa operacional');
    return W.recordForm({ title: row ? 'Editar tarefa' : 'Nova tarefa operacional', table: D.TABLES.tasks, row: row || { ...context, employer_id: context.employer_id || firstValue(state.employer), month_ref: firstValue(state.month) || M.today().slice(0, 7), status: 'A fazer', priority: 'Média', team_scope: 'team', owner_user_key: context.owner_user_key || D.profile.nome }, fields: [
      { name: 'title', label: 'Tarefa', required: true, wide: true }, { name: 'description', label: 'Descrição', type: 'textarea', wide: true }, ...employerFields(), { name: 'month_ref', label: 'Mês', type: 'month' }, { name: 'owner_user_key', label: 'Responsável' }, { name: 'team_scope', label: 'Escopo da equipe' }, { name: 'priority', label: 'Prioridade', type: 'select', options: ['Baixa', 'Média', 'Alta', 'Crítica'], required: true, placeholder: null }, { name: 'status', label: 'Situação', type: 'select', options: ['A fazer', 'Em andamento', 'Bloqueado', 'Pronto', 'Cancelado'], required: true, placeholder: null }, { name: 'start_date', label: 'Início', type: 'date' }, { name: 'due_date', label: 'Prazo', type: 'date' }, { name: 'notes', label: 'Observações / resultado', type: 'textarea', wide: true }
    ], prepare(v, c) {
      if (v.start_date && v.due_date && v.due_date < v.start_date) throw new Error('O prazo não pode ser anterior ao início.');
      if (!row) Object.assign(v, { context_type: context.meeting_id ? 'meeting' : v.employer_id ? 'employer' : 'internal', assigned_user_key: v.owner_user_key, completed_at: v.status === 'Pronto' ? new Date().toISOString() : null, sort_index: 0, is_recurring: false, deleted_at: null, meeting_id: context.meeting_id || null });
      if (row && 'employer_id' in c) c.context_type = row.meeting_id ? 'meeting' : v.employer_id ? 'employer' : 'internal';
      if ('owner_user_key' in c) c.assigned_user_key = v.owner_user_key;
      if ('status' in c && (!row || Object.prototype.hasOwnProperty.call(row, 'completed_at'))) c.completed_at = v.status === 'Pronto' ? new Date().toISOString() : null;
    }, after: load });
  }
  async function finishTask(row) {
    if (!row || !D.canEdit() || !M.isOpen(row.status)) return;
    const payload = { status: 'Pronto' };
    if (Object.prototype.hasOwnProperty.call(row, 'completed_at')) payload.completed_at = new Date().toISOString();
    await D.update(D.TABLES.tasks, row.id, payload, row.updated_at ? { expectedUpdatedAt: row.updated_at } : {});
    U.toast('Tarefa concluída. A entrega continua registrada no histórico.', 'success');
    await load();
  }
  function editMetric(row) {
    if (!D.canEdit()) return readonlyDetail(row, 'Métrica');
    return W.recordForm({ title: row ? 'Editar métrica' : 'Nova métrica', table: D.TABLES.metrics, row: row || { month_ref: state.month || M.today().slice(0, 7), team_scope: 'team', target_value: 0, actual_value: 0 }, fields: [
      { name: 'metric_label', label: 'Métrica', required: true, wide: true }, { name: 'month_ref', label: 'Mês', type: 'month', required: true }, { name: 'owner_user_key', label: 'Responsável' }, { name: 'target_value', label: 'Meta', type: 'number', step: 'any', required: true }, { name: 'actual_value', label: 'Realizado', type: 'number', step: 'any', required: true }, { name: 'team_scope', label: 'Escopo' }, { name: 'notes', label: 'Leitura / contexto', type: 'textarea', wide: true }
    ], prepare(v) { if (!row) { v.metric_key = `metric_${D.uuid()}`; v.deleted_at = null; } }, after: load });
  }
  function editSummary(row) {
    if (!D.canEdit()) return readonlyDetail(row, 'Resumo');
    return W.recordForm({ title: row ? 'Editar resumo manual' : 'Novo resumo manual', table: D.TABLES.summaries, row: row || { employer_id: firstValue(state.employer), month_ref: firstValue(state.month) || M.today().slice(0, 7), status: 'Em andamento', owner_name: D.profile.nome }, fields: [
      ...employerFields(), { name: 'month_ref', label: 'Mês', type: 'month', required: true }, { name: 'week_label', label: 'Semana' }, { name: 'owner_name', label: 'Responsável' }, { name: 'period_start', label: 'Início do período', type: 'date' }, { name: 'period_end', label: 'Fim do período', type: 'date' }, { name: 'status', label: 'Situação', type: 'select', options: PLAN_STATUS, required: true, placeholder: null }, ...R.fields([['what_was_done', 'O que foi feito', 'textarea'], ['result_summary', 'Resultado', 'textarea'], ['next_action', 'Próxima ação', 'textarea'], ['notes', 'Observações', 'textarea']])
    ], prepare(v, c) { snapshotEmployer(v, c, row); if (v.period_start && v.period_end && v.period_end < v.period_start) throw new Error('Revise as datas do período.'); if (!row) Object.assign(v, { summary_scope: v.employer_id ? 'employer' : 'team', order_index: 0, deleted_at: null }); if ('employer_id' in c) c.summary_scope = v.employer_id ? 'employer' : 'team'; }, after: load });
  }
  function editReplacement(row) {
    if (!D.canEdit()) return readonlyDetail(row, 'Reposição');
    let meta = {};
    try { meta = JSON.parse(row?.notes || '{}'); } catch (_) { meta = { obs: row?.notes || '' }; }
    if (!meta || typeof meta !== 'object') meta = { obs: row?.notes || '' };
    const draft = { ...row, ...meta, employer_id: row?.employer_id || firstValue(state.employer), priority: row?.priority || 'Alta', search_status: row?.search_status || 'Aguardando', qtd: meta.qtd || 1 };
    const id = row?.id || D.uuid();
    return W.form({ title: row ? 'Editar reposição' : 'Nova reposição', row: draft, fields: [
      ...employerFields(), { name: 'profile_needed', label: 'Perfil necessário', required: true }, { name: 'replaces_candidate_name_snapshot', label: 'Talento substituído' }, { name: 'qtd', label: 'Quantidade', type: 'number', min: 1, required: true }, { name: 'priority', label: 'Prioridade', type: 'select', options: ['Baixa', 'Média', 'Alta', 'Crítica'], required: true, placeholder: null }, { name: 'search_status', label: 'Situação', type: 'select', options: ['Aguardando', 'Em busca', 'Enviado', 'Concluído', 'Cancelado'], required: true, placeholder: null }, { name: 'dataSolicitacao', label: 'Data da solicitação', type: 'date' }, { name: 'dataNovoEnvio', label: 'Data do novo envio', type: 'date' }, { name: 'gatilho', label: 'Motivo da reposição', wide: true }, { name: 'obs', label: 'Observações', type: 'textarea', wide: true }
    ], onSubmit: async (v, c) => {
      const db = Object.fromEntries(['employer_id', 'profile_needed', 'replaces_candidate_name_snapshot', 'priority', 'search_status'].filter((key) => !row || key in c).map((key) => [key, v[key]]));
      if (!row || 'employer_id' in c) db.employer_name_snapshot = W.find(state.employers, v.employer_id)?.nome || row?.employer_name_snapshot || null;
      if (!row || ['qtd', 'dataSolicitacao', 'dataNovoEnvio', 'gatilho', 'obs'].some((key) => key in c)) db.notes = JSON.stringify({ ...meta, __t4_replacement_v1: true, qtd: v.qtd, dataSolicitacao: v.dataSolicitacao, data: v.dataSolicitacao, dataNovoEnvio: v.dataNovoEnvio, gatilho: v.gatilho, obs: v.obs });
      await W.saveRecord(D.TABLES.replacements, row, { ...db, deleted_at: null }, db, id);
      U.toast('Reposição salva.', 'success'); await load();
    } });
  }
  function historyView() {
    const intro = W.note('Consulta somente leitura do acervo do Organizacional armazenado no Supabase. Não importa planilhas, não restaura backups e não substitui registros atuais. Informações existentes apenas no navegador antigo não podem ser recuperadas por esta consulta.');
    if (!state.archive) return intro + W.button('Consultar acervo anterior', 'load-archive', '', { className: 'primary', icon: 'history' });
    const data = M.snapshotEntries(state.archive.payload);
    return intro + `<p class="t4-muted">Última gravação do acervo: ${e(U.formatDate(state.archive.updated_at, true))}</p>` + (Object.keys(data).length ? Object.entries(data).map(([key, value]) => `<details class="t4-disclosure"><summary>${e({ employers: 'Empregadores', planEntries: 'Planejamento', meetings: 'Reuniões', weeklySummaries: 'Resumos', dossiers: 'Dossiês, removidos e reposições', operationalTasks: 'Tarefas', operationalMetrics: 'Métricas' }[key] || key)} · ${Array.isArray(value) ? value.length : Object.keys(value || {}).length} registros</summary>${Array.isArray(value) ? value.filter(matchQuery).map((r) => `<details class="t4-disclosure"><summary>${e(r.name || r.title || r.tema || r.activity || r.done || r.id || 'Registro')}</summary><div class="t4-detail-grid">${Object.entries(r).map(([k, v]) => U.field(k, typeof v === 'object' ? JSON.stringify(v, null, 2) : v)).join('')}</div></details>`).join('') : `<pre class="t4-raw">${e(JSON.stringify(value, null, 2))}</pre>`}</details>`).join('') : W.note('Nenhum acervo encontrado para esta aplicação. Isso não significa que os registros das tabelas atuais foram excluídos.', 'warning'));
  }
  W.bind(app, { change(key, value) { state[key] = value; render(); }, async action(name, id) {
    if (name === 'reload') return D.session ? load() : location.reload();
    if (name === 'go') { U.closeDrawer(); state.status = []; app.route(id); return; }
    if (name === 'v24-view') { U.closeDrawer(); state.status = []; state.employer = []; app.route(id); return; }
    if (name === 'display') { state.employerDisplay = id; render(); return; }
    if (name === 'employer-display') { state.employerDisplay = ['cards', 'list'].includes(id) ? id : 'list'; render(); return; }
    if (name === 'multi-filter-clear') { if (id in state) state[id] = []; render(); return; }
    if (name === 'active-filter-remove') { const [key, value] = JSON.parse(id); if (Array.isArray(state[key])) state[key] = state[key].filter((v) => v !== value); render(); return; }
    if (name === 'employer-scope') { state.employerScope = ['active', 'all', 'archived'].includes(id) ? id : 'active'; state.employer = []; state.status = []; render(); return; }
    if (name === 'employer-classification') { state.employerClassification = ['all', 'partner', 'nectanet', 'general', 'pending'].includes(id) ? id : 'all'; render(); return; }
    if (name === 'opportunity-scope') { state.opportunityScope = ['open', 'all', 'closed'].includes(id) ? id : 'open'; state.status = []; render(); return; }
    if (name === 'selection-display') { state.selectionDisplay = id === 'cards' ? 'cards' : 'list'; render(); return; }
    if (name === 'selection-archive') { state.selectionShowClosed = !state.selectionShowClosed; render(); return; }
    if (name === 'go-employer') { state.employer = id === 'internal' ? '' : id; app.route('employers'); return; }
    if (name === 'clear') { state.employer = []; state.month = []; state.status = []; state.query = ''; state.employerScope = 'active'; state.employerClassification = 'all'; state.employerDisplay = 'list'; state.opportunityScope = 'open'; state.selectionShowClosed = false; app.resetSearch(); render(); return; }
    if (name.startsWith('month-')) { const date = new Date(`${state.calendar}-01T12:00:00`); date.setMonth(date.getMonth() + (name === 'month-prev' ? -1 : 1)); state.calendar = name === 'month-today' ? M.today().slice(0, 7) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; render(); return; }
    if (name === 'employer-detail') return employerDetail(W.find(state.employers, id));
    if (name === 'edit-employer') return editEmployer(W.find(state.employers, id));
    if (name === 'opening-detail') return openingDetail(W.find(state.openings, id));
    if (name === 'edit-opening') return editOpening(W.find(state.openings, id));
    if (name === 'new-opening-for') return editOpening(null, id);
    if (name === 'selection-for-opening') return R.editSelection(state, null, { opening_id: id }, load);
    if (name === 'selection-detail') return R.selectionDrawer(state, state.selections.rows.find((r) => r.key === id));
    if (name === 'edit-selection') return R.editSelection(state, state.selections.rows.find((r) => r.key === id), {}, load);
    if (name === 'edit-plan') return editPlan(W.find(state.plans, id));
    if (name === 'meeting-detail') return meetingDetail(W.find(state.meetings, id));
    if (name === 'edit-meeting') return editMeeting(W.find(state.meetings, id));
    if (name === 'meeting-task') { const m = W.find(state.meetings, id); return editTask(null, { title: m.next_action || m.pending_items || m.title, description: m.decision_summary, meeting_id: m.id, employer_id: m.employer_id, owner_user_key: m.owner_name }); }
    if (name === 'edit-task') return editTask(W.find(state.tasks, id));
    if (name === 'finish-task') return finishTask(W.find(state.tasks, id));
    if (name === 'new-task') return editTask();
    if (name === 'edit-metric' || name === 'new-metric') return editMetric(W.find(state.metrics, id));
    if (name === 'edit-summary') return editSummary(W.find(state.summaries, id));
    if (name === 'edit-replacement' || name === 'new-replacement') return editReplacement(W.find(state.replacements, id));
    if (name === 'edit-activity') return R.editActivity(state, W.find(state.activities, id), {}, load);
    if (name === 'finish-activity') return R.finishActivity(W.find(state.activities, id), load);
    if (name === 'load-archive') {
      const result = await D.optionalSelect(D.TABLES.archive, 'payload,updated_at', (q) => q.eq('app_key', 'talents4_crm_v5').limit(1));
      if (!result.available) throw new Error('Acervo indisponível. Nenhuma restauração foi executada.');
      state.archive = result.data[0] || { payload: {} }; render();
    }
  } });
  app.onRoute(() => { state.status = []; render(); });
  W.start(app, async () => {
    await load();
    const id = new URLSearchParams(location.search).get('employer');
    if (id && !state.openedInitial) { state.openedInitial = true; employerDetail(W.find(state.employers, id)); }
  }, [...Object.keys(sources).flatMap((key) => key === 'selections' ? [D.TABLES.matches, D.TABLES.legacyMatches, D.TABLES.legacyLinks] : [D.TABLES[key] || (key === 'talents' ? D.TABLES.candidates : '')]), D.TABLES.contacts]);
})();
