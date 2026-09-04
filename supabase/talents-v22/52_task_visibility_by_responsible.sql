-- TALENTS 4 · P.O. É A FILA DE TAREFAS
--
-- Aplicar manualmente em homologação depois da 50_crm_collaboration_scope.sql
-- e da 51_fix_chat_creation_permissions.sql. Esta migração é aditiva: não
-- apaga tarefas, planos ou histórico. Os planos antigos permanecem no banco,
-- mas deixam de ser a unidade de visibilidade do P.O.; a unidade passa a ser
-- a própria tarefa e seus responsáveis.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preconditions$
begin
  if to_regclass('public.operational_tasks') is null
    or to_regclass('public.usuarios') is null
    or to_regprocedure('public.t4_talents_v22_access(boolean)') is null
    or to_regprocedure('public.current_username_from_auth()') is null then
    raise exception 'A base de tarefas/autorização ainda não está pronta. Aplique a V2 e a migração 50 antes da 52.';
  end if;
end;
$preconditions$;

-- Uma linha representa um responsável adicional. O responsável principal
-- continua armazenado em operational_tasks.owner_user_key (e, no legado,
-- assigned_user_key); não é duplicado nesta tabela.
create table if not exists public.operational_task_responsibles (
  id text primary key default gen_random_uuid()::text,
  task_id text not null,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  deleted_at timestamptz
);
alter table public.operational_task_responsibles add column if not exists task_id text;
alter table public.operational_task_responsibles add column if not exists username text;
alter table public.operational_task_responsibles add column if not exists created_at timestamptz default now();
alter table public.operational_task_responsibles add column if not exists updated_at timestamptz default now();
alter table public.operational_task_responsibles add column if not exists created_by uuid default auth.uid();
alter table public.operational_task_responsibles add column if not exists updated_by uuid default auth.uid();
alter table public.operational_task_responsibles add column if not exists deleted_at timestamptz;
create unique index if not exists operational_task_responsibles_unique on public.operational_task_responsibles (task_id, username);
create index if not exists operational_task_responsibles_task_idx on public.operational_task_responsibles (task_id) where deleted_at is null;
create index if not exists operational_task_responsibles_user_idx on public.operational_task_responsibles (lower(username)) where deleted_at is null;

-- O criador/dono e todos os responsáveis adicionais possuem a mesma leitura
-- da tarefa. A função é SECURITY DEFINER para evitar recursão das policies ao
-- consultar a própria tabela de tarefas e a tabela de associações.
create or replace function public.t4_collab_task_visible(task_key text)
returns boolean language sql stable security definer set search_path=public,pg_catalog
as $fn$
  select exists (
    select 1
    from public.operational_tasks t
    where t.id::text=task_key
      and (
        exists (
          select 1
          from public.usuarios u
          where lower(u.username)=lower(public.current_username_from_auth())
            and lower(coalesce(nullif(btrim(t.owner_user_key),''),nullif(btrim(t.assigned_user_key),''))) in (lower(u.username),lower(u.nome))
        )
        or exists (
          select 1
          from public.operational_task_responsibles r
          where r.task_id=t.id::text
            and r.deleted_at is null
            and lower(r.username)=lower(public.current_username_from_auth())
        )
      )
  );
$fn$;

create or replace function public.t4_collab_task_editable(task_key text)
returns boolean language sql stable security definer set search_path=public,pg_catalog
as $fn$
  select public.t4_collab_task_visible(task_key);
$fn$;

revoke all on function public.t4_collab_task_visible(text) from public,anon;
revoke all on function public.t4_collab_task_editable(text) from public,anon;
grant execute on function public.t4_collab_task_visible(text),public.t4_collab_task_editable(text) to authenticated,service_role;

-- O banco filtra a lista mesmo que um cliente tente consultar a tabela sem o
-- recorte da interface. Não há DELETE exposto pelo frontend; o histórico é
-- preservado por deleted_at, mas a policy continua limitada ao responsável.
alter table public.operational_task_responsibles enable row level security;
alter table public.operational_tasks enable row level security;
revoke all on public.operational_task_responsibles from public,anon;
grant select,insert,update on public.operational_task_responsibles to authenticated;
grant select,insert,update on public.operational_tasks to authenticated;
grant all on public.operational_task_responsibles to service_role;

drop policy if exists t4_collab_task_responsibles_read on public.operational_task_responsibles;
drop policy if exists t4_collab_task_responsibles_insert on public.operational_task_responsibles;
drop policy if exists t4_collab_task_responsibles_update on public.operational_task_responsibles;
create policy t4_collab_task_responsibles_read on public.operational_task_responsibles as restrictive for select to authenticated
  using (public.t4_talents_v22_access(false) and public.t4_collab_task_visible(task_id));
create policy t4_collab_task_responsibles_insert on public.operational_task_responsibles as restrictive for insert to authenticated
  with check (public.t4_talents_v22_access(true) and public.t4_collab_task_editable(task_id) and nullif(btrim(username),'') is not null);
create policy t4_collab_task_responsibles_update on public.operational_task_responsibles as restrictive for update to authenticated
  using (public.t4_talents_v22_access(true) and public.t4_collab_task_editable(task_id))
  with check (
    public.t4_talents_v22_access(true)
    and nullif(btrim(username),'') is not null
    and (deleted_at is not null or public.t4_collab_task_editable(task_id))
  );

-- Substitui somente as policies de escopo criadas na 50. As tabelas de
-- operational_plans/operational_plan_members são mantidas para compatibilidade
-- e não participam mais da autorização das tarefas.
drop policy if exists t4_collab_tasks_access on public.operational_tasks;
drop policy if exists t4_collab_tasks_scope on public.operational_tasks;
drop policy if exists t4_collab_tasks_read on public.operational_tasks;
drop policy if exists t4_collab_tasks_insert on public.operational_tasks;
drop policy if exists t4_collab_tasks_update on public.operational_tasks;
drop policy if exists t4_collab_tasks_delete on public.operational_tasks;
create policy t4_collab_tasks_access on public.operational_tasks as permissive for all to authenticated
  using (public.t4_talents_v22_access(false))
  with check (public.t4_talents_v22_access(true));
create policy t4_collab_tasks_read on public.operational_tasks as restrictive for select to authenticated
  using (public.t4_talents_v22_access(false) and public.t4_collab_task_visible(id::text));
create policy t4_collab_tasks_insert on public.operational_tasks as restrictive for insert to authenticated
  with check (
    public.t4_talents_v22_access(true)
    and exists (
      select 1
      from public.usuarios u
      where lower(u.username)=lower(public.current_username_from_auth())
        and lower(coalesce(nullif(btrim(owner_user_key),''),nullif(btrim(assigned_user_key),''))) in (lower(u.username),lower(u.nome))
    )
  );
create policy t4_collab_tasks_update on public.operational_tasks as restrictive for update to authenticated
  using (public.t4_talents_v22_access(true) and public.t4_collab_task_editable(id::text))
  with check (public.t4_talents_v22_access(true));
create policy t4_collab_tasks_delete on public.operational_tasks as restrictive for delete to authenticated
  using (public.t4_talents_v22_access(true) and public.t4_collab_task_editable(id::text));

-- Notifica o responsável principal e cada responsável adicional. A trigger
-- de tarefa roda antes das associações adicionais; a trigger da tabela nova
-- completa as notificações de quem foi marcado no formulário.
create or replace function public.t4_collab_notify_task()
returns trigger language plpgsql security definer set search_path=public,pg_catalog
as $fn$
declare recipient text; task_title text; owner_value text;
begin
  task_title=coalesce(new.title,'Nova tarefa operacional');
  owner_value=coalesce(nullif(btrim(new.owner_user_key),''),nullif(btrim(new.assigned_user_key),''));
  for recipient in
    select u.username
    from public.usuarios u
    where owner_value is not null
      and (lower(u.username)=lower(owner_value) or lower(u.nome)=lower(owner_value))
    union
    select r.username
    from public.operational_task_responsibles r
    where r.task_id=new.id::text and r.deleted_at is null
  loop
    perform public.t4_collab_add_notification(recipient,'po','Nova pendência no P.O.',task_title,'operational_task',new.id::text,'po-task:'||new.id::text||':'||recipient);
  end loop;
  return new;
end;
$fn$;

create or replace function public.t4_collab_notify_task_responsible()
returns trigger language plpgsql security definer set search_path=public,pg_catalog
as $fn$
declare task_title text;
begin
  if new.deleted_at is not null then return new; end if;
  if tg_op='UPDATE' and old.deleted_at is not distinct from new.deleted_at and old.username is not distinct from new.username then return new; end if;
  select title into task_title from public.operational_tasks where id::text=new.task_id;
  perform public.t4_collab_add_notification(new.username,'po','Você foi marcado como responsável',coalesce(task_title,'Uma tarefa operacional foi compartilhada com você.'),'operational_task',new.task_id,'po-responsible:'||new.task_id||':'||new.username);
  return new;
end;
$fn$;

do $triggers$
begin
  if to_regclass('public.operational_tasks') is not null then
    execute 'drop trigger if exists t4_collab_task_notify on public.operational_tasks';
    execute 'create trigger t4_collab_task_notify after insert on public.operational_tasks for each row execute function public.t4_collab_notify_task()';
  end if;
  execute 'drop trigger if exists t4_collab_task_responsible_notify on public.operational_task_responsibles';
  execute 'create trigger t4_collab_task_responsible_notify after insert or update on public.operational_task_responsibles for each row execute function public.t4_collab_notify_task_responsible()';
end;
$triggers$;

do $realtime$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='operational_task_responsibles') then
    execute 'alter publication supabase_realtime add table public.operational_task_responsibles';
  end if;
end;
$realtime$;

do $verify$
begin
  if not (select relrowsecurity from pg_class where oid=to_regclass('public.operational_task_responsibles')) then
    raise exception 'RLS não está ativo em operational_task_responsibles.';
  end if;
  if has_table_privilege('anon','public.operational_task_responsibles','SELECT') then
    raise exception 'anon ainda possui SELECT em operational_task_responsibles.';
  end if;
  if not exists (select 1 from pg_proc where proname='t4_collab_task_visible' and pronamespace='public'::regnamespace) then
    raise exception 'Helper de visibilidade das tarefas não foi criado.';
  end if;
end;
$verify$;

notify pgrst,'reload schema';
commit;
