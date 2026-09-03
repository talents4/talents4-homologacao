-- Talents 4 · investigação das 3 tabelas encontradas ao vivo no Supabase que
-- não são referenciadas em nenhum arquivo deste repositório (achadas pelos
-- hints de erro do PostgREST durante a auditoria via API REST).
-- SOMENTE LEITURA. Não cria, altera ou remove nada. Não lê nenhuma linha de
-- dado de negócio — só catálogo do Postgres (colunas, tipos, RLS, índices,
-- chaves estrangeiras nos dois sentidos) e contagem de linhas (count(*), sem
-- ler o conteúdo de nenhuma coluna).
-- Execute no SQL Editor do projeto de homologação correto (xcxqtjzlqmncwnhbolnl).

with alvo(table_name) as (
  values ('org_employer_profiles'), ('org_matches'), ('drive_import_drafts')

-- 1) A tabela existe mesmo? (confirma o que a API REST já indicou)
), existencia as (
  select a.table_name, (to_regclass('public.'||a.table_name) is not null) as existe
  from alvo a

-- 2) Colunas e tipos
), colunas as (
  select c.table_name, c.ordinal_position, c.column_name, c.data_type, c.udt_name,
    c.is_nullable, c.column_default
  from information_schema.columns c
  join alvo a on a.table_name = c.table_name
  where c.table_schema = 'public'

-- 3) Chave primária e constraints (unique/check/foreign)
), constraints_info as (
  select tc.table_name, tc.constraint_type, tc.constraint_name,
    string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as colunas
  from information_schema.table_constraints tc
  join alvo a on a.table_name = tc.table_name
  left join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
  where tc.table_schema = 'public'
  group by tc.table_name, tc.constraint_type, tc.constraint_name

-- 4) Quem referencia quem: FKs que SAEM dessas tabelas
), fk_saida as (
  select
    tc.table_name as tabela_origem, kcu.column_name as coluna_origem,
    ccu.table_name as tabela_referenciada, ccu.column_name as coluna_referenciada
  from information_schema.table_constraints tc
  join alvo a on a.table_name = tc.table_name
  join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
  where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'

-- 5) Quem referencia essas tabelas de fora (FKs que ENTRAM)
), fk_entrada as (
  select
    tc.table_name as tabela_origem, kcu.column_name as coluna_origem,
    ccu.table_name as tabela_referenciada, ccu.column_name as coluna_referenciada
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
  join alvo a on a.table_name = ccu.table_name
  where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'

-- 6) RLS: está ligado? Quais policies existem e para quem?
), rls_status as (
  select c.relname as table_name, c.relrowsecurity as rls_ligado, c.relforcerowsecurity as rls_forcado
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join alvo a on a.table_name = c.relname
  where n.nspname = 'public'
), policies as (
  select p.tablename as table_name, p.policyname, p.permissive, p.roles, p.cmd,
    p.qual as usando, p.with_check as verificacao_gravacao
  from pg_policies p
  join alvo a on a.table_name = p.tablename
  where p.schemaname = 'public'

-- 7) Grants: quais papéis (anon/authenticated/service_role/outros) têm o quê
), grants_info as (
  select g.table_name, g.grantee, string_agg(g.privilege_type, ', ' order by g.privilege_type) as privilegios
  from information_schema.role_table_grants g
  join alvo a on a.table_name = g.table_name
  where g.table_schema = 'public'
  group by g.table_name, g.grantee

-- 8) Triggers
), triggers_info as (
  select event_object_table as table_name, trigger_name, event_manipulation, action_timing, action_statement
  from information_schema.triggers
  join alvo a on a.table_name = event_object_table
  where trigger_schema = 'public'

-- 9) Contagem de linhas — só o número, nenhuma coluna de conteúdo é lida.
-- As 3 tabelas já foram confirmadas existentes pela sondagem via API REST
-- (auditoria anterior) — sem guarda condicional aqui de propósito, porque
-- "select count(*) from tabela_inexistente" falha na análise da consulta
-- mesmo dentro de um WHERE que nunca seria satisfeito (Postgres valida o
-- nome da relação antes de decidir se a linha aparece no resultado).
), contagens as (
  select 'org_employer_profiles' as table_name, count(*) as total_linhas from public.org_employer_profiles
  union all
  select 'org_matches', count(*) from public.org_matches
  union all
  select 'drive_import_drafts', count(*) from public.drive_import_drafts

-- 10) Comentário da tabela, se alguém documentou algo em algum momento
), comentarios as (
  select c.relname as table_name, d.description as comentario
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join alvo a on a.table_name = c.relname
  left join pg_description d on d.objoid = c.oid and d.objsubid = 0
  where n.nspname = 'public'
)
select '01_EXISTE' as secao, table_name, existe::text as detalhe_1, null as detalhe_2, null as detalhe_3 from existencia
union all
select '02_COLUNA', table_name, column_name || ' :: ' || data_type || coalesce(' (' || udt_name || ')', ''),
  'nullable=' || is_nullable, coalesce('default=' || column_default, 'sem default')
  from colunas
union all
select '03_CONSTRAINT', table_name, constraint_type, constraint_name, colunas from constraints_info
union all
select '04_FK_SAINDO', tabela_origem, coluna_origem || ' -> ' || tabela_referenciada || '.' || coluna_referenciada, null, null from fk_saida
union all
select '05_FK_ENTRANDO', tabela_referenciada, tabela_origem || '.' || coluna_origem || ' -> aqui.' || coluna_referenciada, null, null from fk_entrada
union all
select '06_RLS', table_name, 'rls_ligado=' || rls_ligado::text, 'rls_forcado=' || rls_forcado::text, null from rls_status
union all
select '07_POLICY', table_name, policyname, cmd || ' / roles=' || array_to_string(roles, ','), coalesce('using: '||usando, '') || coalesce(' with_check: '||verificacao_gravacao, '') from policies
union all
select '08_GRANT', table_name, grantee, privilegios, null from grants_info
union all
select '09_TRIGGER', table_name, trigger_name, action_timing || ' ' || event_manipulation, action_statement from triggers_info
union all
select '10_CONTAGEM_LINHAS', table_name, total_linhas::text, null, null from contagens
union all
select '11_COMENTARIO', table_name, coalesce(comentario, '(nenhum comentário registrado na tabela)'), null, null from comentarios
order by 1, 2;
