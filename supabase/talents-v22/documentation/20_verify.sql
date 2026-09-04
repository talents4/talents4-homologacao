-- Documentação · verificação somente leitura após a aplicação manual.
with object_check as (
  select
    to_regclass('public.documentation_nodes') is not null as table_exists,
    coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.documentation_nodes')), false) as rls_enabled,
    to_regprocedure('public.t4_documentation_access(boolean)') is not null as access_function_exists,
    to_regprocedure('public.t4_documentation_validate()') is not null as validate_function_exists,
    to_regprocedure('public.t4_documentation_touch()') is not null as touch_function_exists
),
policy_check as (
  select count(*) = 3 as three_policies
    from pg_policies
   where schemaname = 'public'
     and tablename = 'documentation_nodes'
     and policyname in ('documentation_nodes_read', 'documentation_nodes_insert', 'documentation_nodes_update')
),
privilege_check as (
  select
    has_table_privilege('anon', 'public.documentation_nodes', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') = false as anon_closed,
    has_table_privilege('authenticated', 'public.documentation_nodes', 'DELETE,TRUNCATE,REFERENCES,TRIGGER') = false as authenticated_no_delete,
    has_table_privilege('authenticated', 'public.documentation_nodes', 'SELECT,INSERT,UPDATE') as authenticated_rw
)
select 'table' as check_group, 'documentation_nodes' as check_name,
       case when table_exists and rls_enabled then 'ok' else 'reprovado' end as result
  from object_check
union all
select 'function', 'documentation_access/validate/touch',
       case when access_function_exists and validate_function_exists and touch_function_exists then 'ok' else 'reprovado' end
  from object_check
union all
select 'policy', 'read/insert/update',
       case when three_policies then 'ok' else 'reprovado' end
  from policy_check
union all
select 'grant', 'anon fechado e authenticated sem DELETE',
       case when anon_closed and authenticated_no_delete and authenticated_rw then 'ok' else 'reprovado' end
  from privilege_check
order by check_group, check_name;
