-- Documentação · migração aditiva para aplicação manual.
-- Pré-requisito: executar documentation-00_preflight.sql e revisar seu resultado.
-- O frontend nunca executa este arquivo e não há privilégio DELETE na tabela.
begin;

do $preconditions$
begin
  if to_regclass('public.documentation_nodes') is not null
    or to_regprocedure('public.t4_documentation_access(boolean)') is not null
    or to_regprocedure('public.t4_documentation_validate()') is not null
    or to_regprocedure('public.t4_documentation_touch()') is not null then
    raise exception 'Objetos da Documentação já existem. Não reaplicar esta migração.';
  end if;
end;
$preconditions$;

create table public.documentation_nodes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.documentation_nodes(id) on delete restrict,
  area text not null check (area in ('talents4', 'employers', 'talents')),
  node_type text not null check (node_type in ('folder', 'link', 'checklist')),
  name text not null check (length(btrim(name)) between 1 and 180),
  talent_id text references public.candidatos(id),
  employer_id uuid references public.employers(id),
  opening_id uuid references public.employer_openings(id),
  provider text check (provider in ('drive', 'dropbox', 'other') or provider is null),
  url text check (url is null or url ~* '^https?://[^/?#@[:space:]]+([/?#][^[:space:]]*)?$'),
  payload jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  constraint documentation_nodes_parent_not_self check (parent_id is null or parent_id <> id),
  constraint documentation_nodes_node_target check (
    (node_type = 'folder' and provider is null and url is null)
    or (node_type = 'link' and provider is not null and url is not null)
    or (node_type = 'checklist' and area = 'talents' and talent_id is not null and provider is null and url is null)
  )
);

create index documentation_nodes_area_parent_idx
  on public.documentation_nodes(area, parent_id, position, name)
  where deleted_at is null;
create index documentation_nodes_talent_idx
  on public.documentation_nodes(talent_id)
  where talent_id is not null and deleted_at is null;
create index documentation_nodes_employer_idx
  on public.documentation_nodes(employer_id)
  where employer_id is not null and deleted_at is null;

create function public.t4_documentation_access(write_access boolean default false)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $fn$
  select auth.uid() is not null and exists (
    select 1
    from public.usuarios u
    where lower(u.username) = lower(public.current_username_from_auth())
      and (u.auth_uid is null or u.auth_uid = auth.uid())
      and upper(coalesce(u.ativo, 'SIM')) = 'SIM'
      and u.role = any(case when write_access
        then array['admin', 'recrutador']
        else array['admin', 'recrutador', 'viewer']
      end)
      and (not write_access or public.can_edit_crm())
  );
$fn$;

create function public.t4_documentation_validate()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $fn$
declare
  parent_area text;
  parent_type text;
  opening_employer text;
begin
  if new.parent_id is not null then
    select p.area, p.node_type
      into parent_area, parent_type
      from public.documentation_nodes p
     where p.id = new.parent_id
       and p.deleted_at is null;
    if parent_area is null or parent_type <> 'folder' or parent_area <> new.area then
      raise exception 'A pasta pai deve existir, estar ativa e pertencer à mesma área.';
    end if;
  end if;

  if new.opening_id is not null then
    select o.employer_id::text
      into opening_employer
      from public.employer_openings o
     where o.id = new.opening_id;
    if opening_employer is null
      or new.employer_id is null
      or new.employer_id::text is distinct from opening_employer then
      raise exception 'A vaga informada não pertence à empresa vinculada.';
    end if;
  end if;

  if new.node_type = 'checklist' and (new.area <> 'talents' or new.talent_id is null) then
    raise exception 'O Checklist Operacional só pode ser criado na área Talentos e exige um candidato.';
  end if;

  return new;
end;
$fn$;

create function public.t4_documentation_touch()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $fn$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'A identidade do registro não pode ser alterada.';
    end if;
    new.created_at = old.created_at;
    new.created_by = old.created_by;
  else
    new.created_at = clock_timestamp();
    new.created_by = auth.uid();
  end if;
  new.updated_at = clock_timestamp();
  new.updated_by = auth.uid();
  return new;
end;
$fn$;

create trigger documentation_nodes_validate
  before insert or update on public.documentation_nodes
  for each row execute function public.t4_documentation_validate();
create trigger documentation_nodes_touch
  before insert or update on public.documentation_nodes
  for each row execute function public.t4_documentation_touch();

revoke all on function public.t4_documentation_access(boolean) from public, anon;
grant execute on function public.t4_documentation_access(boolean) to authenticated, service_role;
revoke all on function public.t4_documentation_validate() from public, anon, authenticated;
revoke all on function public.t4_documentation_touch() from public, anon, authenticated;

alter table public.documentation_nodes enable row level security;
revoke all on public.documentation_nodes from public, anon, authenticated;
grant select, insert, update on public.documentation_nodes to authenticated;
grant all on public.documentation_nodes to service_role;

create policy documentation_nodes_read
  on public.documentation_nodes
  for select to authenticated
  using (public.t4_documentation_access(false));
create policy documentation_nodes_insert
  on public.documentation_nodes
  for insert to authenticated
  with check (public.t4_documentation_access(true));
create policy documentation_nodes_update
  on public.documentation_nodes
  for update to authenticated
  using (public.t4_documentation_access(true))
  with check (public.t4_documentation_access(true));

comment on table public.documentation_nodes is
  'Pastas, atalhos e Checklist Operacional da área Documentação; exclusão lógica por deleted_at.';
comment on column public.documentation_nodes.payload is
  'Dados do template Checklist Operacional; links e pastas usam objeto vazio.';

notify pgrst, 'reload schema';
commit;
