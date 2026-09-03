-- SOMENTE LEITURA · executar após aplicação autorizada, em consulta separada.
-- Não confirma sozinho acesso efetivo: testar depois com perfis reais em homologação.
with expected(name) as (
  values ('talent_mapping_profiles'),('talent_mapping_items'),('talent_mapping_partners')
), inspected as (
  select e.name,c.oid,c.relrowsecurity,
    case when c.oid is not null then has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') end as anon_any,
    case when c.oid is not null then has_table_privilege('authenticated',c.oid,'SELECT') end as auth_select,
    case when c.oid is not null then has_table_privilege('authenticated',c.oid,'INSERT') end as auth_insert,
    case when c.oid is not null then has_table_privilege('authenticated',c.oid,'UPDATE') end as auth_update,
    case when c.oid is not null then has_table_privilege('authenticated',c.oid,'DELETE,TRUNCATE,TRIGGER') end as auth_destructive,
    (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=e.name and p.policyname like 'tm22_%') as policy_count
  from expected e left join pg_class c on c.oid=to_regclass('public.'||e.name)
)
select name as tabela,relrowsecurity as rls,anon_any,auth_select,auth_insert,auth_update,auth_destructive,policy_count,
  case when oid is null then 'NAO_APLICADO'
    when relrowsecurity and not anon_any and auth_select and auth_insert and auth_update and not auth_destructive and policy_count=3 then 'OK_ESTRUTURAL'
    else 'REVISAR' end as resultado
from inspected order by name;
