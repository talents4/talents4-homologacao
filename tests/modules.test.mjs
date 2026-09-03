import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, plain } from './harness.mjs';

for (const module of ['talents', 'organization', 'contacts', 'german']) {
  test(`${module}: todas as rotas geram conteúdo sem rede e sem gravações na abertura`, async () => {
    const h = await makeHarness().load(module);
    for (const view of h.app.config.views) {
      h.app.route(view.id); assert.ok(h.html().length > 150, view.id);
      assert.doesNotMatch(h.html(), /\bNaN\b|>undefined</, view.id);
    }
    assert.equal(h.fixture.writes.length, 0); assert.equal(h.network.length, 0);
  });
}
test('Meu dia renderiza nos dois módulos com um gráfico compartilhado disponível', async () => {
  for (const [module, marker] of [['talents', /t4-dist|t4-funnel/], ['organization', /mx-pulse|t4-funnel/]]) {
    const h = await makeHarness().load(module);
    h.app.route('overview');
    assert.match(h.html(), marker);
    assert.doesNotMatch(h.html(), /W\.funnelChart|funnelChart is not a function/);
    assert.equal(h.fixture.writes.length, 0);
  }
});
test('filtros compartilhados oferecem pesquisa e seleção múltipla sem gravar', async () => {
  const h = await makeHarness().load('organization');
  h.app.route('employers');
  assert.match(h.html(), /data-multi-filter-search="employer"/);
  assert.match(h.html(), /data-multi-filter="employer"/);
  h.filter('employer', [h.id(101), h.id(102)]);
  assert.match(h.html(), /2 selecionados/);
  assert.equal(h.fixture.writes.length, 0);
});
test('filtro de períodos destaca o mês atual e escala por ano', async () => {
  const h = makeHarness();
  h.fixture.db.organizational_meetings.push({ ...h.fixture.db.organizational_meetings[0], id: h.id(1008), month_ref: '2027-01', topic: 'Reunião de janeiro de 2027' });
  await h.load('organization'); h.app.route('meetings');
  const html = h.html();
  assert.match(html, /t4-period-filter/);
  assert.match(html, /Mês atual/);
  assert.match(html, /data-period-current="true"/);
  assert.match(html, /Setembro de 2026/);
  assert.match(html, /data-period-year="2027"/);
  assert.match(html, /Janeiro de 2027/);
  assert.ok(html.indexOf('Mês atual') < html.indexOf('Janeiro de 2027'));
  h.filter('month', '2027-01');
  assert.match(h.html(), /Reunião de janeiro de 2027/);
  assert.doesNotMatch(h.html(), /Prioridades da semana/);
  h.app.route('operations');
  assert.match(h.html(), /MÊS DE EXECUÇÃO/);
  assert.match(h.html(), /Setembro de 2026/);
  await h.action('operations-month-next');
  assert.match(h.html(), /Outubro de 2026/);
  await h.action('operations-month-today');
  assert.match(h.html(), /Setembro de 2026/);
  h.app.route('planning');
  assert.match(h.html(), /data-action="planning-month-prev"/);
  assert.match(h.html(), /Setembro de 2026/);
});
test('planejamento separa o que falta fazer do histórico do mês', async () => {
  const h = makeHarness();
  h.fixture.db.organizational_plan_entries.push({ ...h.fixture.db.organizational_plan_entries[0], id: h.id(1009), activity_label: 'Atividade concluída no mês', status: 'Concluído', completed_at: '2026-09-02', start_date: '2026-09-01', end_date: '2026-09-02' });
  await h.load('organization'); h.app.route('planning');
  const html = h.html();
  assert.match(html, /A fazer neste mês/);
  assert.match(html, /Histórico do mês/);
  assert.match(html, /Atividade concluída no mês/);
  assert.ok(html.indexOf('Histórico do mês') < html.indexOf('Atividade concluída no mês'));
  assert.ok(html.indexOf('A fazer neste mês') < html.indexOf('Histórico do mês'));
  h.filter('status', 'Em andamento');
  assert.match(h.html(), /Atividade concluída no mês/);
});
test('classificação dos empregadores é acionável e prioriza parceiras diretas', async () => {
  const h = makeHarness();
  h.fixture.db.employers[0].direct_talents4_partnership = 'CONFIRMADA';
  h.fixture.db.employers[1].company_scope = 'GENERAL';
  await h.load('organization');
  h.app.route('employers');
  await h.action('employer-classification', 'all');
  const names = [...h.html().matchAll(/data-action="employer-detail" data-id="[^"]+">([^<]+)</g)].map(([, name]) => name);
  assert.deepEqual(names, ['Clínica Aurora · exemplo', 'Nord Technik · exemplo']);
  assert.match(h.html(), /data-action="employer-classification" data-id="partner"/);
  await h.action('employer-classification', 'partner');
  const partnerNames = [...h.html().matchAll(/data-action="employer-detail" data-id="[^"]+">([^<]+)</g)].map(([, name]) => name);
  assert.deepEqual(partnerNames, ['Clínica Aurora · exemplo']);
  assert.equal(h.fixture.writes.length, 0);
});
test('Organizacional abre em Empregadores com parceiras e cartões em destaque', async () => {
  const h = makeHarness();
  h.fixture.db.employers[0].direct_talents4_partnership = 'CONFIRMADA';
  await h.load('organization');
  assert.equal(h.app.view, 'employers');
  assert.match(h.html(), /data-action="employer-classification" data-id="partner"[^>]*aria-pressed="true"/);
  assert.match(h.html(), /data-action="employer-display" data-id="cards"[^>]*aria-pressed="true"/);
  assert.doesNotMatch(h.html(), /Uma empresa por vez|A fila operacional mostra/);
});
test('seletores longos mostram busca sem mudar o valor nativo do formulário', async () => {
  const h = makeHarness();
  h.fixture.db.employers.push(...Array.from({ length: 20 }, (_, i) => ({ ...h.fixture.db.employers[0], id: h.id(500 + i), nome: `Empresa ${i}` })));
  await h.load('organization');
  await h.action('new-opening-for', h.id(101));
  assert.match(h.forms.at(-1).innerHTML, /data-select-search="employer_id"/);
  assert.match(h.forms.at(-1).innerHTML, /name="employer_id"/);
  assert.equal(h.fixture.writes.length, 0);
});
test('busca deixa claro quando o Talento arquivado ainda tem seleção ativa', async () => {
  const h = makeHarness();
  h.fixture.db.candidatos[0].ativo = false;
  await h.load('talents');
  h.app.search('Marina');
  assert.match(h.html(), /também no arquivo/);
  assert.match(h.html(), /Arquivado · 1 seleção em andamento/);
  assert.match(h.html(), /Abrir ficha/);
  assert.equal(h.fixture.writes.length, 0);
});
test('exportação exige uma seleção explícita de Talentos', async () => {
  const h = await makeHarness().load('talents');
  await h.action('data-center');
  assert.match(h.notices.at(-1)?.[0] || '', /Selecione ao menos um Talento/);
  assert.equal(h.fixture.writes.length, 0);
});
test('rótulos legados são traduzidos somente na apresentação', async () => {
  const h = makeHarness();
  assert.equal(h.originalCore.term('Novo candidato'), 'Novo Talento');
  assert.equal(h.originalCore.term('Pronto para employer'), 'Pronto para apresentação');
  assert.equal(h.originalCore.term('Enviado ao employer'), 'Apresentado ao empregador');
});
test('Organizacional mostra planejamento, decisões, PO e resumo de fontes antigas', async () => {
  const h = await makeHarness().load('organization');
  for (const [view, text] of [['planning', 'Alinhar apresentação de perfis'], ['meetings', 'Confirmar horários'], ['operations', 'Histórico completo']]) {
    h.app.route(view); assert.match(h.html(), new RegExp(text));
  }
  h.app.route('summary'); h.filter('status', 'Concluído'); assert.match(h.html(), /Revisão de perfis/);
  assert.match(h.html(), /Apresentação/);
  assert.ok(!h.fixture.reads.some((r) => r.table === 'org_ui_state_snapshots'));
  await h.action('meeting-detail', h.id(1002)); assert.match(h.drawer.options.body, /Revisão do planejamento/);
});
test('planejamento edita somente o campo alterado; datas, ordem e observações ficam preservadas', async () => {
  const h = await makeHarness().load('organization');
  h.fixture.db.organizational_plan_entries[0].campo_compatibilidade = 'Não alterar';
  await h.action('edit-plan', h.id(1001));
  for (const key of ['obs', 'start_date', 'end_date', 'responsavel', 'employer_id', 'month_ref']) assert.ok(h.fields().includes(key), key);
  assert.equal((await h.submit({ responsavel: 'Equipe revisora' })).error, '');
  assert.deepEqual(plain(h.fixture.writes.at(-1).payload), { responsavel: 'Equipe revisora' });
  assert.equal(h.fixture.db.organizational_plan_entries[0].campo_compatibilidade, 'Não alterar');
});
test('planejamento rejeita prazo anterior ao início sem enviar uma gravação', async () => {
  const h = await makeHarness().load('organization'); await h.action('edit-plan', h.id(1001));
  const result = await h.submit({ start_date: '2026-10-10', end_date: '2026-09-01' });
  assert.match(result.error, /posterior/); assert.equal(h.fixture.writes.length, 0);
});
test('decisão de reunião cria tarefa referenciada, sem reescrever a reunião', async () => {
  const h = await makeHarness().load('organization'); const meeting = JSON.stringify(h.fixture.db.organizational_meetings);
  await h.action('meeting-task', h.id(1002));
  assert.equal((await h.submit()).error, '');
  const write = h.fixture.writes.at(-1); assert.equal(write.table, 'operational_tasks');
  assert.equal(write.payload.meeting_id, h.id(1002)); assert.equal(write.payload.context_type, 'meeting');
  assert.equal(JSON.stringify(h.fixture.db.organizational_meetings), meeting);
});
test('filtro de status das tarefas não oculta o histórico concluído do mês', async () => {
  const h = makeHarness();
  h.fixture.db.operational_tasks.push({ ...h.fixture.db.operational_tasks[0], id: h.id(1007), title: 'Tarefa concluída no mês', status: 'Pronto', completed_at: '2026-09-01', due_date: '2026-09-01' });
  await h.load('organization'); h.app.route('operations'); h.filter('status', 'A fazer');
  assert.match(h.html(), /Tarefa concluída no mês/);
  assert.match(h.html(), /Histórico completo/);
  assert.doesNotMatch(h.html(), /Métricas do período/);
});
test('PO separa atividades do mês do histórico completo paginado', async () => {
  const h = makeHarness();
  const base = h.fixture.db.operational_tasks[0];
  h.fixture.db.operational_tasks.push({ ...base, id: h.id(1007), title: 'Tarefa aberta de outro mês', month_ref: '2026-08', updated_at: '2026-08-20T10:00:00Z', due_date: '2026-08-25' });
  h.fixture.db.operational_tasks.push(...Array.from({ length: 21 }, (_, i) => ({ ...base, id: h.id(1100 + i), title: `Histórico concluído ${i + 1}`, status: 'Pronto', month_ref: '2026-08', completed_at: `2026-08-${String(21 - (i % 10)).padStart(2, '0')}T10:00:00Z`, updated_at: `2026-08-${String(21 - (i % 10)).padStart(2, '0')}T10:00:00Z`, due_date: `2026-08-${String(21 - (i % 10)).padStart(2, '0')}` })));
  await h.load('organization'); h.app.route('operations');
  const html = h.html(), historyStart = html.indexOf('Histórico completo');
  assert.match(html, /Atividades do mês/);
  assert.doesNotMatch(html, /Cartões de prontidão/);
  assert.match(html, /data-table="operations-history"/);
  assert.match(html, /Página 1 de 2/);
  assert.ok(historyStart > html.indexOf('Atividades do mês'));
  assert.ok(html.indexOf('Tarefa aberta de outro mês', historyStart) >= 0);
  assert.ok(html.indexOf('Tarefa aberta de outro mês', historyStart) < html.indexOf('Histórico concluído 1', historyStart));

  await h.action('operations-month-prev');
  const augustHtml = h.html(), augustHistoryStart = augustHtml.indexOf('Histórico completo');
  assert.match(augustHtml, /Agosto de 2026/);
  assert.ok(augustHtml.indexOf('Tarefa aberta de outro mês') < augustHistoryStart);
  assert.match(augustHtml, /data-table="operations-history"/);
});
test('PO operacional alterna entre atividades em cartões e lista completa', async () => {
  const h = makeHarness();
  h.fixture.db.operational_tasks.push({ ...h.fixture.db.operational_tasks[0], id: h.id(1007), title: 'Tarefa já concluída', status: 'Pronto', priority: 'Crítica', completed_at: '2026-08-31T12:00:00Z', due_date: '2026-08-31' });
  await h.load('organization'); h.app.route('operations');
  const html = h.html();
  assert.match(html, /data-action="operations-display" data-id="activities"[^>]*aria-pressed="true"/);
  assert.match(html, /data-action="operations-display" data-id="all"[^>]*aria-pressed="false"/);
  assert.match(html, /Atividades do mês/);
  assert.match(html, /org-ready-card-deadline/);
  assert.doesNotMatch(html, /org-ready-summary/);
  assert.doesNotMatch(html, /Métricas do período/);
  assert.doesNotMatch(html, /Lista completa/);
  assert.equal((html.match(/data-ready-task=/g) || []).length, 1);
  assert.doesNotMatch(html, /data-table="tasks"/);

  await h.action('operations-display', 'all');
  const listHtml = h.html();
  assert.match(listHtml, /data-action="operations-display" data-id="all"[^>]*aria-pressed="true"/);
  assert.match(listHtml, /Lista completa/);
  assert.doesNotMatch(listHtml, /data-ready-task=/);
  const listStart = html.indexOf('data-table="tasks"');
  const listStartAfterSwitch = listHtml.indexOf('data-table="tasks"');
  assert.equal(listStart, -1);
  assert.ok(listStartAfterSwitch >= 0);
  assert.ok(listHtml.indexOf('Preparar pauta das entrevistas', listStartAfterSwitch) < listHtml.indexOf('Tarefa já concluída', listStartAfterSwitch));
  assert.match(listHtml, /Concluir/);
  assert.ok(listHtml.indexOf('<h2>Histórico completo') > listHtml.indexOf('Lista completa'));

  await h.action('operations-display', 'activities');
  await h.action('finish-task', h.id(1005));
  assert.equal(h.fixture.writes.at(-1).table, 'operational_tasks');
  assert.equal(h.fixture.writes.at(-1).payload.status, 'Pronto');
  assert.ok(h.fixture.db.operational_tasks[0].completed_at);
  assert.equal((h.html().match(/data-ready-task=/g) || []).length, 0);
});
test('detalhes de empregador e vaga com histórico encerrado não chamam W.badge', async () => {
  const h = makeHarness();
  h.fixture.db.talent_opportunity_matches.push({ id: h.id(305), created_at: '2026-09-01T10:00:00.000Z', updated_at: '2026-09-01T10:00:00.000Z', talent_id: 'DEMO-T2', opening_id: h.id(201), employer_id: h.id(101), stage: 'Encerrado', status: 'Encerrado', priority: 3, owner_username: 'demo', next_action: null, next_action_at: null, viability: 'Baixa', overall_score: null, reasons: null, barriers: null, sent_at: null, responded_at: null });
  await h.load('organization');
  await h.action('employer-detail', h.id(101));
  assert.match(h.drawer.options.body, /Histórico de seleções encerradas/);
  await h.action('opening-detail', h.id(201));
  assert.match(h.drawer.options.body, /Histórico encerrado/);
  assert.equal(h.fixture.writes.length, 0);
});
test('nova seleção grava vínculo por vaga sem mudar o acompanhamento do talento', async () => {
  const h = await makeHarness().load('talents'); const original = JSON.stringify(h.fixture.db.candidatos);
  h.app.route('processes'); h.app.primary();
  assert.equal((await h.submit({ talent_id: 'DEMO-T3', opening_id: h.id(202), stage: 'Em análise', next_action: 'Agendar avaliação' })).error, '');
  assert.equal(h.fixture.writes.at(-1).table, 'talent_opportunity_matches');
  assert.equal(h.fixture.writes.at(-1).payload.employer_id, h.id(102));
  assert.equal(JSON.stringify(h.fixture.db.candidatos), original);
});
test('vínculo antigo é editado na própria origem, nunca inserido como seleção moderna', async () => {
  const h = await makeHarness().load('talents');
  await h.action('edit-selection', `candidate_employer_matches:${h.id(303)}`);
  assert.equal((await h.submit({ proxima_acao: 'Próximo passo revisado' })).error, '');
  assert.equal(h.fixture.writes.length, 1); assert.equal(h.fixture.writes[0].table, 'candidate_employer_matches');
  assert.equal(h.fixture.db.talent_opportunity_matches.length, 2);
});
test('duplicidade talento + vaga é bloqueada antes da inclusão', async () => {
  const h = await makeHarness().load('talents'); h.app.route('processes'); h.app.primary();
  const result = await h.submit({ talent_id: 'DEMO-T1', opening_id: h.id(201) });
  assert.match(result.error, /já está vinculado/); assert.equal(h.fixture.writes.length, 0);
});
test('ficha completa é lida sob demanda, inclusive campos fora da listagem', async () => {
  const h = await makeHarness().load('talents'); h.fixture.db.candidatos[0].campo_historico = 'Informação anterior preservada';
  assert.ok(!h.fixture.reads.some((r) => r.table === 'candidatos' && r.columns === '*'));
  await h.action('talent-detail', 'DEMO-T1'); await h.action('detail-tab', 'all');
  assert.match(h.drawer.options.body, /Informação anterior preservada/);
});
// "Todos os dados" existe para preservar o que não tem apresentação
// dedicada — não para repetir com o nome bruto da coluna o que a aba
// Perfil/Alemão/Documentos/Histórico já mostra formatado. Sem a lista de
// exclusão passada a R.storedFields(), a ficha inteira do Talento parecia
// uma planilha crua nessa aba (achado ao revisar a tela com o usuário).
test('aba "Todos os dados" não repete campo com apresentação dedicada em outra aba', async () => {
  const h = await makeHarness().load('talents');
  await h.action('talent-detail', 'DEMO-T1');
  assert.match(h.drawer.options.body, /talento1@example\.invalid/, 'e-mail aparece formatado na aba Perfil');
  await h.action('detail-tab', 'all');
  assert.doesNotMatch(h.drawer.options.body, /t4-detail-label">Email</, 'e-mail não deve ser repetido cru no bloco de sobras');
  assert.doesNotMatch(h.drawer.options.body, /t4-detail-label">Nome completo</, 'nome não deve ser repetido cru no bloco de sobras');
  assert.doesNotMatch(h.drawer.options.body, /t4-detail-label">Resumo profissional</, 'texto longo já mostrado em Perfil não deve duplicar');
  assert.match(h.drawer.options.body, /Data entrada etapa atual/, 'campo genuinamente sem apresentação dedicada continua preservado');
});
test('turma mantém instituição, horários, links e professor vinculado', async () => {
  const h = await makeHarness().load('german'); await h.action('class-detail', h.id(901));
  assert.match(h.drawer.options.body, /Instituto de demonstração/); assert.match(h.drawer.options.body, /19h BRT/);
  await h.action('edit-class', h.id(901));
  for (const key of ['provider', 'schedule_text', 'meeting_link', 'drive_link', 'teacher_contact_id', 'teacher_name']) assert.ok(h.fields().includes(key), key);
  assert.equal((await h.submit({ notes: 'Observação revisada' })).error, '');
  assert.deepEqual(plain(h.fixture.writes.at(-1).payload), { notes: 'Observação revisada' });
});
test('registro de presença usa uma gravação; métricas são responsabilidade do banco', async () => {
  const h = await makeHarness().load('german'); const original = JSON.stringify(h.fixture.db.candidatos);
  await h.action('new-update', h.id(911));
  assert.equal((await h.submit({ attendance_status: 'Presente', event_date: '2026-09-01', note: 'Registro de teste' })).error, '');
  assert.deepEqual(plain(h.fixture.writes.map((r) => r.table)), ['german_course_updates']);
  assert.equal(h.fixture.db.german_course_updates.at(-1).attendance_status, 'Presente');
  assert.equal(JSON.stringify(h.fixture.db.candidatos), original);
});
test('avaliação não carrega presença indevida e mantém os registros anteriores', async () => {
  const h = await makeHarness().load('german'); await h.action('new-update', h.id(911));
  assert.equal((await h.submit({ kind: 'Avaliação', score: 82, attendance_status: 'Presente' })).error, '');
  assert.equal(h.fixture.db.german_course_updates.at(-1).attendance_status, null);
  assert.equal(h.fixture.db.german_course_updates.length, 2);
  assert.equal(h.fixture.db.german_course_enrollments[0].last_assessment_score, 82);
});
test('aluno sem frequência medida não aparece indevidamente na lista de risco', async () => {
  const h = await makeHarness().load('german'); h.app.route('attention');
  assert.match(h.html(), /Lucas Vieira/); assert.doesNotMatch(h.html(), /Sofia Almeida/);
  await h.action('enrollment-detail', h.id(912)); assert.match(h.drawer.options.body, /Sem registro/);
});
test('Contatos mantém canais secundários, endereço, vínculos e histórico', async () => {
  const h = await makeHarness().load('contacts'); await h.action('contact-detail', `contact:${h.id(501)}`);
  assert.match(h.drawer.options.body, /Resumo fictício de uma interação/);
  assert.match(h.drawer.options.body, /Vincular a talento ou empregador existente/);
  await h.action('edit-contact', `contact:${h.id(501)}`);
  for (const field of ['secondary_email', 'whatsapp', 'primary_organization_id', 'address_line', 'postal_code', 'preferred_channel', 'language']) assert.ok(h.fields().includes(field), field);
});
test('abrir acompanhamento de talento sem contato auxiliar não cria registro antes de salvar', async () => {
  const h = await makeHarness().load('contacts'); await h.action('new-followup', 'talent:DEMO-T2');
  assert.equal(h.fixture.writes.length, 0);
  h.U.closeModal(); assert.equal(h.fixture.writes.length, 0);
  await h.action('new-interaction', 'talent:DEMO-T2'); assert.equal(h.fixture.writes.length, 0);
});
test('edição de contato vinculado atualiza identificação na origem canônica', async () => {
  const h = await makeHarness().load('contacts'); const originalStatus = h.fixture.db.candidatos[0].status_pipeline;
  await h.action('edit-contact', 'talent:DEMO-T1');
  assert.equal((await h.submit({ phone: '+55 00 00000-0023' })).error, '');
  assert.equal(h.fixture.db.candidatos[0].telefone, '+55 00 00000-0023');
  assert.equal(h.fixture.db.candidatos[0].status_pipeline, originalStatus);
  assert.ok(h.fixture.writes.some((r) => r.table === 'candidatos'));
  assert.ok(!h.fixture.writes.some((r) => r.operation === 'insert'));
});
test('falha depois de salvar a origem não anuncia sucesso completo nem permite repetição cega', async () => {
  const h = await makeHarness().load('contacts');
  h.fixture.writeErrors.contact_records = { code: '42501', message: 'permission denied' };
  await h.action('edit-contact', 'talent:DEMO-T1');
  const result = await h.submit({ phone: '+55 00 00000-0034', notes: 'Complemento' });
  assert.match(result.error, /dados principais foram salvos/); assert.equal(result.disabled, true);
  assert.equal(h.fixture.db.candidatos[0].telefone, '+55 00 00000-0034');
  assert.equal(h.fixture.db.contact_records.find((r) => r.id === h.id(504)).notes, 'Histórico do contato vinculado.');
});
test('vincular contato existente preserva o ID e seu histórico, sem criar talento', async () => {
  const h = await makeHarness().load('contacts'); const count = h.fixture.db.candidatos.length;
  await h.action('link-canonical', `contact:${h.id(501)}`);
  assert.equal((await h.submit({ target_key: 'talent:DEMO-T2' })).error, '');
  assert.equal(h.fixture.db.candidatos.length, count);
  assert.equal(h.fixture.db.contact_records.find((r) => r.id === h.id(501)).source_record_id, 'DEMO-T2');
  assert.equal(h.fixture.db.contact_interactions[0].contact_id, h.id(501));
});
test('viewer consegue abrir o detalhe de uma atividade sem controles de gravação', async () => {
  const h = await makeHarness({ role: 'viewer' }).load('talents');
  await h.action('edit-activity', h.id(401));
  assert.match(h.drawer.options.body, /ação compartilhada/); assert.equal(h.forms.length, 0); assert.equal(h.fixture.writes.length, 0);
});
test('acervo do Organizacional só é lido ao solicitar, sem importar dados', async () => {
  const h = await makeHarness().load('organization'); h.app.route('history');
  assert.equal(h.fixture.reads.some((r) => r.table === 'org_ui_state_snapshots'), false);
  await h.action('load-archive'); assert.match(h.html(), /Parceiro anterior/); assert.match(h.html(), /Contexto preservado/);
  assert.equal(h.fixture.writes.length, 0);
});
test('nome do professor alterado em Contatos é lido em Alemão com o mesmo ID', async () => {
  const h = await makeHarness().load('contacts'); await h.action('edit-contact', `contact:${h.id(501)}`);
  assert.equal((await h.submit({ display_name: 'Professor atualizado · exemplo' })).error, '');
  await h.load('german'); await h.action('class-detail', h.id(901));
  assert.match(h.drawer.options.body, /Professor atualizado/); assert.equal(h.fixture.db.german_course_classes[0].teacher_contact_id, h.id(501));
});
test('talento criado passa a aparecer na agenda de Contatos sem outro cadastro de pessoa', async () => {
  const h = await makeHarness().load('talents'); await h.app.primary();
  assert.equal((await h.submit({ nome_completo: 'Novo talento de teste', email: 'novo@example.invalid' })).error, '');
  await h.load('contacts'); assert.match(h.html(), /Novo talento de teste/);
  assert.equal(h.fixture.db.contact_records.length, 4); assert.equal(h.fixture.db.candidatos.length, 6);
});
test('histórico de aulas acima do limite padrão é paginado por completo', async () => {
  const h = makeHarness(), sample = h.fixture.db.german_course_updates[0];
  h.fixture.db.german_course_updates = Array.from({ length: 1203 }, (_, n) => ({ ...sample, id: h.id(10000 + n), note: `Registro fictício ${n}` }));
  h.fixture.pageCap = 100;
  await h.load('german'); h.app.route('history');
  assert.equal(h.app.counts.history, 1203); assert.match(h.html(), /de 1203/);
  assert.equal(h.fixture.writes.length, 0);
});
test('salvar formulário sem alteração não envia atualização vazia ao banco', async () => {
  const h = await makeHarness().load('german'); await h.action('edit-class', h.id(901));
  assert.equal((await h.submit()).error, ''); assert.equal(h.fixture.writes.length, 0);
});
test('resposta incerta impede um segundo envio do mesmo formulário', async () => {
  const h = await makeHarness().load('german'); h.fixture.writeErrors.german_course_classes = { message: 'Failed to fetch' };
  await h.action('edit-class', h.id(901));
  const first = await h.submit({ notes: 'Teste de resposta incerta' }); assert.equal(first.disabled, true);
  delete h.fixture.writeErrors.german_course_classes; await h.submit({ notes: 'Tentativa duplicada' });
  assert.equal(h.fixture.writes.length, 0);
});
