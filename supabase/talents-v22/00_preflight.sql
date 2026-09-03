-- TALENTOS 2.2 · SOMENTE LEITURA. Executar primeiro e revisar o resultado.
-- Não consulta nomes, contatos, linhas de Talentos nem conteúdo de currículos.
with required_columns(table_name, column_name, accepted_types) as (
  values
    ('candidatos','id',array['text']),
    ('candidatos','nome_completo',array['text','character varying']),
    ('candidatos','ultima_atualizacao',array['timestamp with time zone','timestamp without time zone']),
    ('employers','id',array['uuid']),
    ('employer_openings','id',array['uuid']),
    ('employer_openings','employer_id',array['text','uuid']),
    ('usuarios','username',array['text','character varying']),
    ('usuarios','ativo',array['text','character varying']),
    ('usuarios','role',array['text','character varying']),
    ('usuarios','auth_uid',array['uuid'])
), optional_columns(column_name, accepted_types) as (
  values
    ('idade',array['text','character varying','integer','numeric']),
    ('area_profissional',array['text','character varying']),
    ('nivel_alemao',array['text','character varying']),
    ('cv_drive_web_link',array['text','character varying']),
    ('experiencia_profissional_tempo',array['text','character varying']),
    ('perfil_profissional_para_apresentacao',array['text','character varying']),
    ('pronto_para_employer',array['text','character varying','boolean']),
    ('lingua_estrangeira',array['text','character varying']),
    ('nivel_lingua_estrangeira',array['text','character varying'])
), functions(signature) as (
  values ('public.can_edit_crm()'),('public.current_username_from_auth()'),('auth.uid()')
), additions(name) as (
  values ('talent_mapping_profiles'),('talent_mapping_items'),('talent_mapping_partners')
), report as (
  select '01_PRE_REQUISITO' as secao, r.table_name||'.'||r.column_name as item,
    case when c.column_name is null then 'BLOQUEIO_AUSENTE' when c.data_type=any(r.accepted_types) then 'OK' else 'BLOQUEIO_TIPO' end as resultado,
    jsonb_build_object('tipo',c.data_type,'aceitos',r.accepted_types) as detalhes
  from required_columns r left join information_schema.columns c
    on c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name
  union all
  select '02_CAMPO_CANONICO','candidatos.'||o.column_name,
    case when c.column_name is null then 'ADICAO_PREVISTA' when c.data_type=any(o.accepted_types) then 'PRESERVAR_EXISTENTE' else 'BLOQUEIO_TIPO' end,
    jsonb_build_object('tipo',c.data_type,'aceitos',o.accepted_types)
  from optional_columns o left join information_schema.columns c
    on c.table_schema='public' and c.table_name='candidatos' and c.column_name=o.column_name
  union all
  select '03_FUNCAO', f.signature, case when p.oid is null then 'BLOQUEIO_AUSENTE' else 'REVISAR_DEFINICAO' end,
    jsonb_build_object('definition',case when p.oid is not null then pg_get_functiondef(p.oid) end)
  from functions f left join pg_proc p on p.oid=to_regprocedure(f.signature)
  union all
  select '04_TABELA_NOVA',a.name,case when to_regclass('public.'||a.name) is null then 'NOVA_PREVISTA' else 'BLOQUEIO_JA_EXISTE' end,
    jsonb_build_object('acao','Se já existe, não reaplicar. Verificar versão/estrutura antes de continuar.')
  from additions a
  union all
  select '05_RLS_EXISTENTE',c.relname,case when c.relrowsecurity then 'OK' else 'BLOQUEIO_RLS_DESATIVADO' end,
    jsonb_build_object('rls',c.relrowsecurity,'politicas',(select jsonb_agg(jsonb_build_object('nome',p.policyname,'roles',p.roles,'comando',p.cmd,'using',p.qual,'check',p.with_check)) from pg_policies p where p.schemaname='public' and p.tablename=c.relname))
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('candidatos','employers','employer_openings','usuarios')
  union all
  select '06_AMBIENTE','PostgreSQL','INFORMACAO',jsonb_build_object('versao',current_setting('server_version'),'banco',current_database(),'usuario_execucao',current_user)
)
select * from report order by secao,item;
