/* Superfície de trabalho exclusiva de Talentos. Não altera os componentes dos outros switches. */
(function () {
  'use strict';
  const U = window.T4V2, W = window.T4Work, D = window.T4Data, M = window.T4Models, T = window.T4TalentMapping;
  const e = U.esc, a = U.attr;
  const labels = { stage: 'Etapas', german: 'Alemão', owner: 'Responsáveis', employer: 'Empregadores', cluster: 'Clusters', visa: 'Visto', qualification: 'Qualificação', cv: 'Novo CV', nectanet: 'Lista NectaNet' };
  const quicks = [{ id: 'mine', label: 'Meus talentos', icon: 'user' }, { id: 'attention', label: 'A acompanhar', icon: 'warning' }, { id: 'course', label: 'Em aulas', icon: 'graduation' }, { id: 'ready', label: 'Prontos para apresentar', icon: 'check' }];
  const profileFields = [
    ['perfil_titulo', 'Perfil / áreas de atuação'], ['perfil_comprovado', 'Perfil comprovado', 'textarea'], ['idiomas_contexto', 'Idiomas', 'textarea'],
    ['regra_revisao', 'Regra desta revisão', 'textarea'], ['premissa_projecao', 'Premissa da projeção B1', 'textarea'],
    ['barreira_principal', 'Barreira principal', 'textarea'], ['prioridade_mapeamento', 'Prioridade do mapeamento']
  ];
  const safe = (value) => M.safeUrl(value);
  function create({ state, app, load, render, talentDetail }) {
    state.filters ||= {}; state.quick = T.list(state.quick).filter((x) => x !== 'all');
    state.multiOpen = ''; state.multiSearch ||= {}; state.mappingStatus ||= []; state.presentationTab ||= 'people'; state.workFilters ||= {}; state.moreFiltersOpen = !!state.moreFiltersOpen;
    const filtered = (options = {}) => T.filterTalents(state, { profile: D.profile, ...options });
    const available = (key) => state.sources?.[key]?.available === true && !state.sources[key].error;
    const requireSource = (key) => { if (!available(key)) throw new Error('Os campos de mapeamento não estão disponíveis. Confira a pré-checagem do Supabase; nenhuma alteração foi gravada.'); };
    const name = (id) => state.talents.find((r) => M.same(r.id, id))?.nome_completo || id;
    function valuesFor(key, people) {
      const values = new Map(), push = (value, label = value) => { if (M.present(value)) values.set(String(value), { value: String(value), label: String(label) }); };
      for (const r of people) {
        const p = T.profileFor(state, r.id);
        if (key === 'stage') push(r.status_pipeline || 'Sem etapa',U.term(r.status_pipeline || 'Sem etapa'));
        if (key === 'german') [r.nivel_alemao, ...T.courseFor(state, r.id).map((x) => x.current_level)].forEach((v) => push(v));
        if (key === 'owner') push(r.responsavel_interno || 'Sem responsável');
        if (key === 'cluster') push(p.cluster || 'Sem cluster');
        if (key === 'visa') push(p.visto || 'Não informado');
        if (key === 'qualification') push(p.profissional_qualificado || 'Não informado');
        if (key === 'cv') push(p.novo_cv || 'Não informado');
        if (key === 'nectanet') push(p.lista_nectanet || 'Não informado');
        if (key === 'employer') {
          const selections = (state.selections?.rows || []).filter((s) => M.same(s.talent_id, r.id));
          const mappingItems = (state.mappingItems || []).filter((s) => !s.archived_at && M.same(s.talent_id, r.id));
          const ids = [...selections.map((s) => s.employer_id), ...mappingItems.map((s) => s.employer_id), p.employer_primary_id, p.employer_alt1_id, p.employer_alt2_id];
          ids.forEach((id) => push(id, state.employers.find((x) => M.same(x.id, id))?.nome || id));
          [...selections.map((s) => s.employer_name_snapshot), ...mappingItems.map((s) => s.employer_name)].filter(M.present)
            .forEach((name) => push(name, `${name} · empresa ainda não cadastrada`));
        }
      }
      return [...values.values()].sort((x, y) => x.label.localeCompare(y.label, 'pt-BR'));
    }
    function multi(key, options, selected, label, counts = null) {
      const search = state.multiSearch[key] || '';
      return `<details class="tw-multiselect" data-tw-multi="${a(key)}" ${state.multiOpen === key ? 'open' : ''}><summary aria-label="Filtrar ${a(label)}"><strong>${e(label)}</strong><span>${selected.length ? `${selected.length} selecionado${selected.length > 1 ? 's' : ''}` : 'Todos'}</span>${U.icon('chevron')}</summary><div class="tw-options"><div class="tw-options-head"><span>Filtrar ${e(label)}</span><button type="button" class="tw-options-close" data-action="multi-close" data-id="${a(key)}" aria-label="Fechar filtro">×</button></div><input type="search" data-tw-search="${a(key)}" placeholder="Buscar opção…" aria-label="Buscar em ${a(label)}" value="${a(search)}"><div class="tw-option-actions">${W.button('Selecionar todos', 'multi-all', key, { className: 'ghost sm' })}${W.button('Limpar', 'multi-clear', key, { className: 'ghost sm' })}</div><div class="tw-option-list">${options.map((o, i) => `<label data-tw-option="${a(M.norm(o.label))}" ${search && !M.norm(o.label).includes(M.norm(search)) ? 'hidden' : ''}><input id="tw-${a(key)}-${i}" type="checkbox" data-tw-check="${a(key)}" value="${a(o.value)}" ${selected.includes(String(o.value)) ? 'checked' : ''}><span>${e(o.label)}</span>${counts ? `<small>${counts(o.value)}</small>` : ''}</label>`).join('') || '<p class="tw-muted">Nenhuma opção neste recorte.</p>'}</div><p>Qualquer opção marcada entra no recorte.</p></div></details>`;
    }
    function toolbar({ extended = false, archived = false } = {}) {
      const people = state.talents.filter((r) => T.active(r) !== archived);
      const keys = ['stage', 'german', 'owner', 'employer', ...(extended ? ['cluster', 'visa', 'qualification', 'cv', 'nectanet'] : [])];
      const count = Object.values(state.filters).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
      const renderFilter = (key) => {
        const selected = state.filters[key] || [], options = valuesFor(key, people);
        for (const s of selected) if (!options.some((o) => o.value === s)) options.push({value:s,label:s});
        const counts = new Map();
        for (const person of filtered({archived,ignore:key})) for (const choice of valuesFor(key,[person])) counts.set(choice.value,(counts.get(choice.value)||0)+1);
        return multi(key, options, selected, labels[key], (value) => counts.get(value)||0);
      };
      const primaryKeys = keys.slice(0, 4), extraKeys = keys.slice(4);
      const activeExtra = extraKeys.reduce((n, key) => n + (state.filters[key] || []).length, 0);
      return `<div class="tw-filter-surface"><div class="tw-filter-head"><div><span class="tw-filter-title">Filtros</span><span class="tw-filter-caption">Combine critérios.</span></div><div class="tw-filter-tools">${W.button('Limpar filtros', 'clear', '', {className:'ghost sm'})}${W.button('Atualizar', 'reload', '', {className:'sm',icon:'refresh'})}</div></div><div class="tw-filter-row">${primaryKeys.map(renderFilter).join('')}${extraKeys.length ? `<details class="tw-more-filters" ${state.moreFiltersOpen ? 'open' : ''}><summary><strong>Mais filtros</strong><span>${activeExtra ? `${activeExtra} ativo${activeExtra > 1 ? 's' : ''}` : 'opcional'}</span>${U.icon('chevron')}</summary><div class="tw-more-filter-grid">${extraKeys.map(renderFilter).join('')}</div></details>` : ''}</div><div class="tw-filter-summary"><span>${count ? `${count} critério${count > 1 ? 's' : ''} ativo${count > 1 ? 's' : ''}` : 'Nenhum filtro adicional'} · Dentro de cada filtro, escolha uma opção ou mais; os filtros se acumulam.</span>${count ? `<div class="tw-active-filters">${Object.entries(state.filters).flatMap(([key, selected]) => (Array.isArray(selected) ? selected : []).map((value) => `<button type="button" data-action="filter-remove" data-id="${a(JSON.stringify([key,value]))}">${e(labels[key])}: ${e(valuesFor(key, people).find((o) => o.value === value)?.label || value)} <span aria-hidden="true">×</span></button>`)).join('')}</div>` : ''}</div></div>`;
    }
    const workLabels = {selectionStage:'Etapas da seleção',selectionEmployer:'Empregadores',selectionOwner:'Responsáveis',activityOwner:'Responsáveis'};
    function workOptions(key) {
      if (key === 'selectionEmployer') return employerChoices();
      const rows=key === 'activityOwner' ? state.activities : state.selections.rows;
      const field=key === 'selectionStage' ? 'stage' : 'owner_username';
      return W.unique(rows,field).map((value)=>({value:String(value),label:U.term(value)}));
    }
    function workToolbar(kind) {
      const keys=kind === 'selections' ? ['selectionStage','selectionEmployer','selectionOwner'] : kind === 'openings' ? ['selectionEmployer'] : ['activityOwner'];
      return `<div class="tw-filter-surface"><div class="tw-filter-row">${keys.map((key)=>multi(key,workOptions(key),state.workFilters[key]||[],workLabels[key])).join('')}<div class="tw-filter-tools">${W.button('Limpar filtros','clear','',{className:'ghost sm'})}${W.button('Atualizar','reload','',{className:'sm',icon:'refresh'})}</div></div></div>`;
    }
    function quickFilters() {
      const picked = (id) => state.quick.includes(id) || id === 'ready' && app.view === 'presentation';
      const all = !state.quick.length && app.view !== 'presentation';
      return `<div class="tw-quickfilters" aria-label="Visões rápidas"><button type="button" class="tw-quick ${all ? 'selected' : ''}" data-action="quick" data-id="all" aria-pressed="${all}">Todos ativos <span>${state.talents.filter(T.active).length}</span></button>${quicks.map((q) => `<button type="button" class="tw-quick ${picked(q.id) ? 'selected' : ''}" data-action="quick" data-id="${q.id}" aria-pressed="${picked(q.id)}">${U.icon(q.icon)}${e(q.label)}<span class="tw-checkmark" aria-hidden="true">${picked(q.id) ? '✓' : '+'}</span></button>`).join('')}</div>`;
    }
    function sheetTabs(current) {
      // As visões principais já estão na navegação lateral. Mantemos a função
      // para compatibilidade com links antigos, mas não duplicamos a navegação.
      return '';
    }
    function scoreCell(value) {
      const n = T.score(value);
      return n == null ? '<span class="tw-unrated">A avaliar</span>' : `<span class="tw-score"><strong>${e(n)}</strong><span>/100</span><i style="--score:${n}%" aria-hidden="true"></i></span>`;
    }
    function editCell(content, action, id, label, editable) {
      return editable && D.canEdit() ? `<button type="button" class="tw-cell-edit" data-action="${a(action)}" data-id="${a(id)}" aria-label="Editar ${a(label)}">${content}${U.icon('edit')}</button>` : `<div class="tw-cell-value">${content}</div>`;
    }
    function grid(view, rows, columns, empty) {
      return `<div class="tw-sheet-grid" data-tw-sheet="${a(view)}">${W.table({id:`tw-${view}`, rows, columns, empty, pageSize:25})}</div>`;
    }
    function presentation() {
      const people = filtered().filter((r) => T.yes(r.pronto_para_employer));
      const rows = T.presentationRows(state, people);
      const tabs = [['people','Talentos priorizados'],['partners','Nectanet Partner'],['companies','Empresas detalhadas']];
      const top = sheetTabs('presentation') + quickFilters() + toolbar({extended:true}) + `<div class="tw-sheet-heading"><div><span class="tw-kicker">APRESENTAÇÃO · FILA DE LIBERAÇÃO</span><h2>${people.length} Talento${people.length === 1 ? '' : 's'} pronto${people.length === 1 ? '' : 's'} para revisão</h2><p>Pronto para apresentar é uma liberação manual. Lista NectaNet é uma classificação de mercado separada e não altera a etapa.</p></div><div class="tw-mode-tabs">${tabs.map(([id,label]) => `<button type="button" data-action="presentation-tab" data-id="${id}" aria-pressed="${state.presentationTab === id}">${e(label)}</button>`).join('')}</div></div>`;
      if (state.presentationTab !== 'people') return top + partners(people, state.presentationTab);
      const columns = T.FIELDS.presentation.map(([key,label,source,type]) => ({key,label,required:['nome_completo','lista_nectanet'].includes(key),className:`tw-col-${key}`,value:(r)=>type==='employer' ? state.employers.find((x)=>M.same(x.id,r[key]))?.nome || '' : r[key],render:(r) => {
        if (key === 'nome_completo') return W.person(r.nome_completo, r.profissao_principal || '', '', 'talent-detail', r.id);
        let value = r[key], content = e(M.present(value) ? value : 'Não informado');
        if (type === 'employer') content = e(state.employers.find((x) => M.same(x.id,value))?.nome || (value ? 'Vínculo indisponível' : 'Não definido'));
        if (type === 'url') return `<div class="tw-link-cell">${safe(value) ? W.external('Abrir CV', value) : '<span class="tw-muted">Sem link</span>'}${D.canEdit() ? W.button('Editar', 'presentation-cell', JSON.stringify([r.id,key]), {className:'ghost sm'}) : ''}</div>`;
        if (key === 'lista_nectanet' || key === 'novo_cv') content = U.badge(value || 'Não informado', T.yes(value) || value === 'Feito' ? 'success' : '');
        if (key === 'perfil_profissional_para_apresentacao' && r._summaryFallback) content = `<span>${content}<small>Exibindo resumo RH existente · ainda não revisado para apresentação</small></span>`;
        if (key === 'ingles' && r._englishFallback) content = `<span>${content}<small>Nível registrado na ficha anterior</small></span>`;
        return editCell(content, 'presentation-cell', JSON.stringify([r.id,key]), label, source === 'talent' || available('mappingProfiles'));
      }}));
      const legend = window.T4V25?.legend?.([{label:'Decisão humana de liberação',tone:'success'},{label:'Classificação NectaNet',tone:'info'},{label:'Dado ainda não informado',tone:''}]) || '';
      return top + legend + grid('presentation',rows,columns,'Nenhum Talento pronto neste recorte. Abra a ficha e revise a liberação antes de apresentar.') + `<p class="tw-table-note">As 18 colunas seguem a ordem da planilha Nectanet. Clique em uma informação para editar; use Colunas para ajustar sua visualização.</p>`;
    }
    function partners(people, mode) {
      const rows = T.partnerRows(state, people), fields = T.FIELDS[mode];
      return grid(mode, rows, fields.map(([key,label]) => ({key,label,required:key === 'empresa',render:(r) => {
        if (key === 'empresa') return W.person(r.empresa, '', '', D.canEdit() && available('mappingPartners') ? 'mapping-partner' : '', r.id);
        if (key === 'count') return `<strong>${r.count}</strong>`;
        return `<div class="tw-multiline">${e(r[key] || 'Não informado')}</div>`;
      }})), 'Nenhuma empresa selecionada nos perfis deste recorte.') + W.note('Os nomes das empresas, descrições e vagas cadastradas são lidos do Organizacional. A contagem considera cada Talento uma única vez por empresa.');
    }
    function trackingTable(rows, radar = false) {
      const fields = T.FIELDS[radar ? 'radar' : 'tracking'];
      return grid(radar ? 'radar' : 'tracking', rows, fields.map(([key,label]) => ({key,label,required:key === 'empresa',className:`tw-col-${key}`,render:(r) => {
        if (key === 'empresa') return W.person(r.empresa, r._saved ? 'Mapeamento' : 'Seleção existente · dados preservados', '', D.canEdit() && available('mappingItems') ? 'mapping-item' : '', r.id);
        if (key === 'talent') return `<button type="button" class="t4-row-link" data-action="mapping-for" data-id="${a(r.talent_id)}">${e(r.talent)}</button>`;
        if (key === 'official_url') return `<div class="tw-link-cell">${safe(r[key]) ? W.external('Fonte oficial',r[key]) : '<span class="tw-muted">Sem link</span>'}${W.button('Editar','mapping-item',r.id,{className:'ghost sm',disabled:!D.canEdit()||!available('mappingItems')})}</div>`;
        let content = ['professional_score','current_viability_score','projected_b1_score'].includes(key) ? scoreCell(r[key]) : key === 'vacancy_status' ? U.badge(r[key], T.openVacancy(r) ? 'success' : '') : key === 'verified_on' ? `${e(U.formatDate(r[key]))}<small>${e(r.verification_notes || '')}</small>` : `<span>${e(r[key] || 'Não informado')}</span>`;
        return editCell(content,'mapping-item',r.id,label,available('mappingItems'));
      }})), 'Nenhuma linha neste recorte. Adicione uma empresa/vaga para iniciar o acompanhamento, sem recriar a ficha do Talento.');
    }
    function tracking() {
      const people = filtered({archived:!!state.mappingArchived});
      const chosen = people.find((r) => M.same(r.id,state.mappingTalent)) || people[0];
      if (chosen) state.mappingTalent = chosen.id;
      const top = sheetTabs('mapping') + (state.mappingArchived ? W.note('Acompanhamento de Talento arquivado. O histórico foi preservado.') : quickFilters()) + toolbar({archived:!!state.mappingArchived});
      if (!chosen) return top + U.emptyState('Nenhum Talento neste recorte','Limpe ou ajuste os filtros para abrir um acompanhamento.');
      const p = T.profileFor(state,chosen.id), rows = T.mappingRows(state).filter((r) => M.same(r.talent_id,chosen.id));
      const statuses = [...new Set(rows.map((r) => r.vacancy_status))].map((v) => ({value:v,label:v}));
      const visible = rows.filter((r) => T.matches(state.mappingStatus,r.vacancy_status));
      return top + `<section class="tw-dossier"><div class="tw-dossier-head"><div><span class="tw-kicker">ACOMPANHAMENTO POR TALENTO</span><label class="tw-person-picker"><span class="tw-sr-only">Selecionar Talento</span><select data-filter="mappingTalent">${W.optionsHtml(people.map((r) => ({value:r.id,label:r.nome_completo})),chosen.id)}</select></label><p>${e(p.perfil_titulo || chosen.profissao_principal || chosen.area_profissional || 'Perfil não informado')}</p></div><div>${W.button('Ficha completa','talent-detail',chosen.id,{className:'sm'})}${W.button('Editar contexto','mapping-profile',chosen.id,{className:'sm',icon:'edit',disabled:!D.canEdit()||!available('mappingProfiles')})}${W.button('Nova linha','mapping-new',chosen.id,{className:'primary sm',icon:'plus',disabled:!D.canEdit()||!available('mappingItems')})}</div></div><div class="tw-context-grid">${[['Perfil comprovado',p.perfil_comprovado],['Idiomas',p.idiomas_contexto || [chosen.nivel_alemao ? `Alemão informado: ${chosen.nivel_alemao}` : '',...T.courseFor(state,chosen.id).map((x) => `Curso: ${x.current_level || 'nível não informado'} · ${x.status}`)].filter(Boolean).join(' | ')],['Regra desta revisão',p.regra_revisao]].map(([label,value]) => `<div><h3>${e(label)}</h3><p>${e(value || 'Ainda não preenchido')}</p></div>`).join('')}</div><div class="tw-projection-note">${U.icon('note')}<p><strong>Cenário projetado, não situação atual.</strong> ${e(p.premissa_projecao || 'A coluna B1 em 3 meses é uma hipótese de evolução apenas do idioma. Reconhecimento, experiência, documentação e requisitos da vaga não mudam automaticamente.')}</p></div></section><div class="tw-mapping-toolbar">${multi('mappingStatus',statuses,state.mappingStatus,'Status da vaga')}<span>${visible.length} de ${rows.length} linha(s) · avaliações manuais de 0 a 100</span></div>` + trackingTable(visible);
    }
    function summary() {
      const rows = T.summaryRows(state,filtered());
      return sheetTabs('mapping-summary') + quickFilters() + toolbar() + grid('summary',rows,T.FIELDS.summary.map(([key,label]) => ({key,label,required:key === 'talent',render:(r) => key === 'talent' ? W.person(r.talent,'','','mapping-for',r.id) : `<span class="tw-multiline">${e(r[key] ?? 'Não definido')}</span>`})),'Nenhum Talento neste recorte.') + W.note('Contagens seguem a planilha: vagas ABERTA, aderência ≥90 e viabilidades ≥60. “Melhor” alvo é uma escolha registrada pela equipe, não uma aprovação automática.');
    }
    function radar() {
      const ids = new Set(filtered().map((r) => String(r.id)));
      const rows = T.mappingRows(state).filter((r) => ids.has(String(r.talent_id)) && T.yes(r.nectanet));
      return `<div class="mx-toolbar"><div><span class="mx-eyebrow">MERCADO · RADAR NECTANET</span><p class="t4-muted">Alvos NectaNet marcados no acompanhamento. O Radar não é uma etapa e não libera apresentações.</p></div><div class="mx-segment" role="group" aria-label="Visões do mercado"><button type="button" data-action="go" data-id="opportunities" data-selected="false">Vagas cadastradas</button><button type="button" data-action="go" data-id="mapping-radar" data-selected="true">Radar NectaNet</button></div></div>` + quickFilters() + toolbar() + trackingTable(rows,true);
    }
    function employerChoices() { return state.employers.map((r) => ({value:r.id,label:r.nome})); }
    function definition([key,label,source,type,options]) {
      const f = { name:key, label, type:type === 'employer' ? 'select' : type || 'text', ...(options ? {options} : {}), wide:type === 'textarea' };
      if (type === 'employer') f.options = employerChoices();
      if (type === 'number') { f.min = 0; if (key === 'idade') f.max = 120; }
      if (key === 'experiencia_profissional_tempo') f.help = 'Aceita texto, como “aprox. 4 a 5 anos”, preservando a informação da planilha.';
      return f;
    }
    async function saveProfile(id, fields, options = {}) {
      requireSource('mappingProfiles');
      const original = state.mappingProfiles.find((r) => M.same(r.id,id));
      return W.form({title:options.title || 'Editar apresentação Nectanet',subtitle:name(id),fields,row:original || {},notice:options.notice || 'Somente estes campos complementares serão alterados. A ficha única e as seleções permanecem preservadas.',
        onSubmit:async (values,changes) => {
          const next = {...original,...(original ? changes : values)};
          const ids = ['employer_primary_id','employer_alt1_id','employer_alt2_id'].map((key) => next[key]).filter(M.present);
          if (new Set(ids).size !== ids.length) throw new Error('Selecione empresas diferentes para principal e alternativas.');
          for (const key of ['best_nectanet_item_id','best_external_item_id']) if (next[key] && !state.mappingItems.some((r) => M.same(r.id,next[key]) && M.same(r.talent_id,id) && !r.archived_at)) throw new Error('O melhor alvo precisa pertencer ao acompanhamento deste Talento.');
          if (original) { if (Object.keys(changes).length) await D.update(T.TABLES.profiles,id,changes,{expectedUpdatedAt:original.updated_at}); }
          else await D.insert(T.TABLES.profiles,{id,...values});
          U.toast('Informação salva no Supabase.','success'); await load();
        }});
    }
    async function presentationCell(id,key) {
      if (!D.canEdit()) return;
      const f = T.FIELDS.presentation.find((x) => x[0] === key);
      if (!f) throw new Error('Campo de apresentação inválido.');
      if (f[2] === 'profile') return saveProfile(id,[definition(f)]);
      return editCanonical(id,[definition(f)],f[1]);
    }
    async function editCanonical(id, fields, title = 'Editar ficha') {
      const original = await D.one(D.TABLES.candidates,id);
      const missing = fields.filter((f) => !(f.name in original));
      if (missing.length) throw new Error(`Campo ausente no esquema: ${missing.map((f) => f.label).join(', ')}. Execute primeiro apenas a pré-checagem preparada; não serão criadas cópias do campo em outro lugar.`);
      return W.form({title,subtitle:original.nome_completo,fields,row:original,
        notice:'Atualiza o cadastro único de Talentos. Na versão conectada, a mudança também pode aparecer nos outros módulos e no sistema principal.',
        onSubmit:async (values,changes) => {
          if (!Object.keys(changes).length) return;
          if ('cv_drive_web_link' in changes && changes.cv_drive_web_link && !safe(changes.cv_drive_web_link)) throw new Error('Informe um link HTTP ou HTTPS válido, sem usuário ou senha embutidos.');
          if ('pronto_para_employer' in changes) {
            if (typeof original.pronto_para_employer === 'boolean') changes.pronto_para_employer = T.yes(changes.pronto_para_employer);
            else if (typeof original.pronto_para_employer === 'number') changes.pronto_para_employer = T.yes(changes.pronto_para_employer) ? 1 : 0;
          }
          await D.update(D.TABLES.candidates,id,{...changes,ultima_atualizacao:new Date().toISOString()},original.ultima_atualizacao ? {expectedUpdatedAt:original.ultima_atualizacao,expectedColumn:'ultima_atualizacao'} : {});
          U.toast('Ficha única atualizada.','success'); await load();
        }});
    }
    async function readiness(id) {
      const original = await D.one(D.TABLES.candidates,id);
      const boolean = typeof original.pronto_para_employer === 'boolean' || typeof original.pronto_para_employer === 'number';
      const opts = boolean ? [{value:'true',label:'Sim — liberado para apresentação'},{value:'false',label:'Não — manter em preparação'}] : [{value:'sim',label:'Sim — liberado para apresentação'},{value:'parcial',label:'Parcial — ainda em preparação'},{value:'nao',label:'Não — manter em preparação'}];
      return editCanonical(id,[{name:'pronto_para_employer',label:'Liberação para apresentação',type:'select',options:opts,required:true,help:'Decisão humana. Não é concedida por score, nível de alemão ou etapa. Não envia e-mails nem documentos.'}],'Revisar liberação para apresentação');
    }
    function mappingProfile(id) {
      const own = T.mappingRows(state).filter((r) => M.same(r.talent_id,id) && r._saved);
      return saveProfile(id,[...profileFields.map(([name,label,type]) => ({name,label,type:type || 'text',wide:type === 'textarea'})),
        {name:'best_nectanet_item_id',label:'Melhor NectaNet',type:'select',options:own.filter((r) => T.yes(r.nectanet)).map((r) => ({value:r.id,label:`${r.empresa} · ${r.vacancy_situation || 'Alvo'}`}))},
        {name:'best_external_item_id',label:'Melhor BW externa',type:'select',options:own.filter((r) => M.norm(r.nectanet) === 'nao').map((r) => ({value:r.id,label:`${r.empresa} · ${r.vacancy_situation || 'Alvo'}`}))}
      ],{title:'Contexto do acompanhamento',notice:'Mantém perfil comprovado, idiomas, regra da revisão e premissas separados dos scores de cada vaga. Só registre como comprovado o que a equipe verificou.'});
    }
    async function mappingItem(id, talentId = null) {
      requireSource('mappingItems');
      const row = id ? T.mappingRows(state).find((r) => r.id === id) : null;
      if (id && !row) throw new Error('Linha não encontrada. Atualize o acompanhamento.');
      const ownerId = row?.talent_id || talentId;
      const original = row?._saved ? state.mappingItems.find((r) => M.same(r.id,row.id)) : null;
      const values = row || {talent_id:ownerId,vacancy_status:'A CONFIRMAR'};
      const coreKeys = {vacancy_status:'status',vacancy_situation:'title',type_area:'area',language_requirement:'language_requirement',recognition_requirement:'recognition_requirement',location:'location',official_url:'external_url'};
      const fields = [
        {section:'Empresa e vínculo'}, {name:'employer_id',label:'Empresa cadastrada',type:'select',options:employerChoices(),readonly:!!row?.source_table},
        {name:'employer_name',label:'Empresa ainda não cadastrada',help:'Use apenas para um alvo de pesquisa sem cadastro. Não cria nem duplica um empregador.',readonly:!!row?.source_table},
        {name:'opening_id',label:'Vaga cadastrada (opcional)',type:'select',options:state.openings.map((r) => ({value:r.id,label:`${state.employers.find((x) => M.same(x.id,r.employer_id))?.nome || ''} · ${r.title}`})),readonly:!!row?.source_table},
        {section:'As 16 informações do acompanhamento'},
        ...T.FIELDS.tracking.filter(([key]) => key !== 'empresa').map((field) => {
          const f = definition(field); if (f.type === 'number') {f.max=100;f.step=0.1;f.help='Avaliação manual, de 0 a 100. Vazio significa ainda não avaliado.';}
          if (coreKeys[f.name] && M.present(row?._opening?.[coreKeys[f.name]])) { f.readonly=true; f.help='Informação da vaga cadastrada, mantida no Organizacional.'; }
          return f;
        }), {name:'verification_notes',label:'Observação da verificação',help:'Complementa “Verificado em”, por exemplo: vaga/portal conferido.'}
      ];
      return W.form({title:original ? 'Editar linha de acompanhamento' : row ? 'Complementar seleção existente' : 'Nova linha de acompanhamento',subtitle:name(ownerId),row:values,fields,
        notice:'Aderência, viabilidade atual e projeção com B1 são avaliações independentes. Vincular uma vaga usa os dados oficiais já cadastrados nela. Não altera a etapa da seleção.',
        onSubmit:async (entered,changes) => {
          T.validateScores(entered);
          const next = {...values,...entered}, opening = state.openings.find((r) => M.same(r.id,next.opening_id));
          if (next.opening_id && !opening) throw new Error('A vaga selecionada não está disponível. Atualize os dados.');
          if (opening && next.employer_id && !M.same(opening.employer_id,next.employer_id)) throw new Error('A vaga selecionada pertence a outro empregador.');
          if (opening) next.employer_id = opening.employer_id;
          if (!row && opening && T.mappingRows(state).some((r)=>M.same(r.talent_id,ownerId)&&M.same(r.opening_id,opening.id))) throw new Error('Esta vaga já está no acompanhamento deste Talento. Abra a linha existente para complementar, sem duplicar.');
          if (!next.employer_id && !String(next.employer_name || '').trim()) throw new Error('Selecione uma empresa ou informe o nome do alvo ainda não cadastrado.');
          if (next.official_url && !safe(next.official_url)) throw new Error('O link oficial precisa ser HTTP ou HTTPS, sem credenciais.');
          const payload = {...(original ? changes : entered)};
          if (!original || 'opening_id' in changes) payload.employer_id=next.employer_id || null;
          if (opening) for (const [key, sourceKey] of Object.entries(coreKeys)) if (M.present(opening[sourceKey])) delete payload[key];
          if (original) { if (Object.keys(payload).length) await D.update(T.TABLES.items,original.id,payload,{expectedUpdatedAt:original.updated_at}); }
          else await D.insert(T.TABLES.items,{id:D.uuid(),talent_id:ownerId,...payload,...(row?.source_table ? {source_table:row.source_table,source_record_id:row.source_record_id,employer_id:row.employer_id,opening_id:row.opening_id || null} : {})});
          U.toast('Acompanhamento salvo, sem alterar a seleção existente.','success'); await load();
        }});
    }
    async function partner(id) {
      requireSource('mappingPartners');
      const original = state.mappingPartners.find((r) => M.same(r.id,id)), employer = state.employers.find((r) => M.same(r.id,id));
      if (!employer) throw new Error('Empregador não disponível para edição.');
      const fields = [
        {name:'is_nectanet',label:'NectaNet?',type:'select',options:['Sim','Não']},{name:'source',label:'nectanet source'},
        {name:'ceo_name',label:'Geschäftsführer',type:'textarea'},{name:'ceo_email',label:'Kontakt-E-Mail',type:'textarea'},
        {name:'hr_name',label:'Personaler',type:'textarea'},{name:'hr_email',label:'Kontakt-E-Mail 2',type:'textarea'},
        {name:'contact_status',label:'Kontaktstatus',type:'select',options:['Offen','Kontakt gefunden','E-Mail gesendet','Antwort erhalten','Nicht relevant','Erledigt']},
        {name:'notes',label:'PS',type:'textarea'}, {name:'send_email',label:'E-mail para envio'},
        {name:'openings_note',label:'Vagas em aberto · anotação complementar',type:'textarea'},
        {name:'sector',label:'Setor / tipo · caso não conste no empregador'}, {name:'description',label:'Descrição · caso não conste no empregador',type:'textarea'}
      ];
      return W.form({title:'Nectanet Partner',subtitle:employer.nome,row:original || {},fields,notice:'Dados complementares da parceria. Nome da empresa, descrição e vagas estruturadas continuam vindo do cadastro único do Organizacional.',
        onSubmit:async (values,changes) => {
          if (original) { if (Object.keys(changes).length) await D.update(T.TABLES.partners,id,changes,{expectedUpdatedAt:original.updated_at}); }
          else await D.insert(T.TABLES.partners,{id,...values});
          U.toast('Informações da parceria salvas.','success'); await load();
        }});
    }
    async function action(action,id) {
      if (action === 'quick') {
        state.quick = id === 'all' ? [] : state.quick.includes(id) || id === 'ready' && app.view === 'presentation' ? state.quick.filter((x) => x !== id) : [...state.quick,id];
        if (app.view === 'presentation' && ['all','ready'].includes(id)) app.route('talents'); else render(); return true;
      }
      if (action === 'filter-remove') { const [key,value]=JSON.parse(id); state.filters[key]=(state.filters[key]||[]).filter((v) => v !== value); render(); return true; }
      if (action === 'multi-close') { state.multiOpen=''; render(); return true; }
      if (action === 'multi-clear' || action === 'multi-all') {
        const vals = action === 'multi-clear' ? [] : id === 'mappingStatus' ? [...new Set(T.mappingRows(state).filter((r) => M.same(r.talent_id,state.mappingTalent)).map((r) => r.vacancy_status))] : id in workLabels ? workOptions(id).map((o)=>String(o.value)) : valuesFor(id,state.talents.filter((r) => T.active(r) !== (app.view === 'archived' || app.view === 'mapping' && !!state.mappingArchived))).map((o) => o.value);
        if (id === 'mappingStatus') state.mappingStatus=vals; else if(id in workLabels) state.workFilters[id]=vals; else state.filters[id]=vals; state.multiOpen=id; render(); return true;
      }
      if (action === 'presentation-tab') {state.presentationTab=id;render();return true;}
      if (action === 'mapping-for') {state.mappingTalent=id;state.mappingArchived=!T.active(state.talents.find((r) => M.same(r.id,id)) || {});state.filters={};state.quick=[];state.mappingStatus=[];state.query='';app.resetSearch();U.closeDrawer();app.route('mapping');return true;}
      if (action === 'readiness') {if(D.canEdit()) await readiness(id);return true;}
      if (action === 'presentation-cell') {if(D.canEdit()) await presentationCell(...JSON.parse(id));return true;}
      if (action === 'presentation-profile') {if(D.canEdit()) await saveProfile(id,T.FIELDS.presentation.filter((f)=>f[2]==='profile').map(definition),{title:'Preparar apresentação Nectanet',notice:'Preencha os complementos antes de liberar. Nome, idade, área, experiência, alemão, CV e resumo permanecem na ficha única. Este formulário não libera nem envia o perfil.'});return true;}
      if (action === 'mapping-profile') {if(D.canEdit()) await mappingProfile(id);return true;}
      if (action === 'mapping-item') {if(D.canEdit()) await mappingItem(id);return true;}
      if (action === 'mapping-new') {if(D.canEdit()) await mappingItem(null,id);return true;}
      if (action === 'mapping-partner') {if(D.canEdit()) await partner(id);return true;}
      return false;
    }
    function change(key,value) {
      if (key === 'mappingTalent') {state.mappingTalent=value;render();return true;}
      if (key in workLabels) {state.workFilters[key]=T.list(value);render();return true;}
      if (key in labels) {state.filters[key]=T.list(value);render();return true;}
      return false;
    }
    document.addEventListener('change',(event) => {
      const input=event.target;
      if (!input.matches?.('[data-tw-check]')) return;
      const key=input.dataset.twCheck, values=key === 'mappingStatus' ? state.mappingStatus : key in workLabels ? state.workFilters[key] || [] : state.filters[key] || [];
      const next=input.checked ? [...new Set([...values,input.value])] : values.filter((v) => v !== input.value);
      if (key === 'mappingStatus') state.mappingStatus=next; else if(key in workLabels) state.workFilters[key]=next; else state.filters[key]=next;
      state.multiOpen=key; const focusId=input.id; render(); document.getElementById?.(focusId)?.focus();
    });
    document.addEventListener('input',(event) => {
      const input=event.target;
      if (!input.matches?.('[data-tw-search]')) return;
      state.multiSearch[input.dataset.twSearch]=input.value;
      input.closest('[data-tw-multi]')?.querySelectorAll('[data-tw-option]').forEach((option) => {option.hidden=!option.dataset.twOption.includes(M.norm(input.value));});
    });
    document.addEventListener('click',(event) => {
      const menu=event.target.closest?.('[data-tw-multi]');
      if (menu) state.multiOpen=menu.dataset.twMulti;
      else if (!event.target.closest?.('.tw-more-filters')) {state.multiOpen=''; state.moreFiltersOpen=false; document.querySelectorAll('[data-tw-multi][open], .tw-more-filters[open]').forEach((n) => n.removeAttribute('open'));}
    });
    document.addEventListener('keydown',(event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('[data-tw-multi][open]').forEach((n) => {n.removeAttribute('open');n.querySelector('summary')?.focus();}); state.multiOpen='';
    });
    document.addEventListener('toggle',(event)=>{
      const menu=event.target;
      if(!menu.isConnected || !menu.matches?.('[data-tw-multi]')) return;
      if(menu.open) {
        state.multiOpen=menu.dataset.twMulti;
        document.querySelectorAll('[data-tw-multi][open]').forEach((other)=>{if(other!==menu) other.removeAttribute('open');});
      } else if(state.multiOpen===menu.dataset.twMulti) state.multiOpen='';
    },true);
    document.addEventListener('toggle',(event)=>{
      const menu=event.target;
      if(!menu.isConnected || !menu.matches?.('details.tw-more-filters')) return;
      state.moreFiltersOpen=menu.open;
      if(!menu.open) state.multiOpen='';
    },true);
    return { filtered, toolbar, workToolbar, quickFilters, sheetTabs, presentation, tracking, summary, radar, available, action, change, mappingProfile, readiness };
  }
  window.T4TalentMappingUI = Object.freeze({create});
})();
