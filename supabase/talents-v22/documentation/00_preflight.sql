-- Documentação · preflight somente leitura.
-- Execute este arquivo isoladamente antes de revisar/aplicar 10_additive.sql.
with required as (
  select * from (values
    ('candidatos', 'id', array['text', 'character varying']::text[]),
    ('candidatos', 'nome_completo', array['text', 'character varying']::text[]),
    ('employers', 'id', array['uuid']::text[]),
    ('employer_openings', 'id', array['uuid']::text[]),
    ('employer_openings', 'employer_id', array['text', 'character varying', 'uuid']::text[]),
    ('usuarios', 'username', array['text', 'character varying']::text[]),
    ('usuarios', 'ativo', array['text', 'character varying']::text[]),
    ('usuarios', 'role', array['text', 'character varying']::text[]),
    ('usuarios', 'auth_uid', array['uuid']::text[])
  ) as values(table_name, column_name, accepted_types)
),
columns_check as (
  select
    r.table_name,
    r.column_name,
    c.data_type,
    case when c.data_type = any(r.accepted_types) then 'ok' else 'incompatível ou ausente' end as status
  from required r
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = r.table_name
   and c.column_name = r.column_name
),
tables_check as (
  select
    t.table_name,
    (to_regclass('public.' || t.table_name) is not null) as exists_in_public,
    coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.' || t.table_name)), false) as rls_enabled
  from (values ('candidatos'), ('employers'), ('employer_openings'), ('usuarios')) as t(table_name)
),
functions_check as (
  select * from (values
    ('public.can_edit_crm()', to_regprocedure('public.can_edit_crm()') is not null),
    ('public.current_username_from_auth()', to_regprocedure('public.current_username_from_auth()') is not null),
    ('auth.uid()', to_regprocedure('auth.uid()') is not null)
  ) as values(function_name, available)
),
new_objects_check as (
  select * from (values
    ('public.documentation_nodes', to_regclass('public.documentation_nodes') is null),
    ('public.t4_documentation_access(boolean)', to_regprocedure('public.t4_documentation_access(boolean)') is null),
    ('public.t4_documentation_validate()', to_regprocedure('public.t4_documentation_validate()') is null),
    ('public.t4_documentation_touch()', to_regprocedure('public.t4_documentation_touch()') is null)
  ) as values(object_name, safe_to_create)
)
select 'base_column' as check_group, table_name || '.' || column_name as check_name, status as result
from columns_check
union all
select 'base_table', table_name, case when exists_in_public and rls_enabled then 'ok' else 'ausente ou RLS desativado' end
from tables_check
union all
select 'auth_function', function_name, case when available then 'ok' else 'ausente' end
from functions_check
union all
select 'new_object', object_name, case when safe_to_create then 'ok' else 'já existe; não reaplicar' end
from new_objects_check
order by check_group, check_name;
