-- TALENTS 4 · COLABORAÇÃO E ESCOPO OPERACIONAL
--
-- Aplicar manualmente SOMENTE após revisar 00_preflight.sql no banco de
-- homologação. Esta migração é aditiva: não apaga candidatos, vínculos,
-- tarefas, reuniões ou históricos. O preenchimento inicial deliberadamente
-- coloca registros sem classificação no Balde; a equipe promove cada pessoa
-- para Talento manualmente, uma a uma.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preconditions$
declare target text;
begin
  foreach target in array array['candidatos','usuarios','operational_tasks'] loop
    if to_regclass('public.'||target) is null then
      raise exception 'Tabela obrigatória ausente: %. Rode a pré-checagem antes desta migração.', target;
    end if;
  end loop;
  if to_regprocedure('public.t4_talents_v22_access(boolean)') is null
    or to_regprocedure('public.current_username_from_auth()') is null then
    raise exception 'Funções de autorização da V2 ausentes. Aplique a base V2 antes da colaboração.';
  end if;
end;
$preconditions$;

-- 1) Classificação operacional do cadastro único.
alter table public.candidatos add column if not exists crm_scope text;
update public.candidatos
set crm_scope = case
  when lower(btrim(crm_scope)) in ('talento','talent','operacional') then 'talento'
  else 'balde'
end;
alter table public.candidatos alter column crm_scope set default 'balde';
alter table public.candidatos alter column crm_scope set not null;
do $constraint$
begin
  if not exists (select 1 from pg_constraint where conname='candidatos_crm_scope_check' and conrelid='public.candidatos'::regclass) then
    alter table public.candidatos add constraint candidatos_crm_scope_check check (crm_scope in ('talento','balde'));
  end if;
end;
$constraint$;
create index if not exists candidatos_crm_scope_idx on public.candidatos (crm_scope);

-- 2) Um P.O. ativo por usuário e uma associação explícita para acompanhar.
create table if not exists public.operational_plans (
  id text primary key default gen_random_uuid()::text,
  owner_username text not null,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  deleted_at timestamptz
);
alter table public.operational_plans add column if not exists owner_username text;
alter table public.operational_plans add column if not exists title text;
alter table public.operational_plans add column if not exists description text;
alter table public.operational_plans add column if not exists created_at timestamptz default now();
alter table public.operational_plans add column if not exists updated_at timestamptz default now();
alter table public.operational_plans add column if not exists created_by uuid default auth.uid();
alter table public.operational_plans add column if not exists updated_by uuid default auth.uid();
alter table public.operational_plans add column if not exists deleted_at timestamptz;
create unique index if not exists operational_plans_owner_unique on public.operational_plans (lower(owner_username)) where deleted_at is null;
create index if not exists operational_plans_owner_idx on public.operational_plans (lower(owner_username));

create table if not exists public.operational_plan_members (
  id text primary key default gen_random_uuid()::text,
  plan_id text not null,
  username text not null,
  permission text not null default 'viewer' check (permission in ('viewer','editor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  deleted_at timestamptz
);
alter table public.operational_plan_members add column if not exists plan_id text;
alter table public.operational_plan_members add column if not exists username text;
alter table public.operational_plan_members add column if not exists permission text default 'viewer';
alter table public.operational_plan_members add column if not exists created_at timestamptz default now();
alter table public.operational_plan_members add column if not exists updated_at timestamptz default now();
alter table public.operational_plan_members add column if not exists created_by uuid default auth.uid();
alter table public.operational_plan_members add column if not exists updated_by uuid default auth.uid();
alter table public.operational_plan_members add column if not exists deleted_at timestamptz;
create unique index if not exists operational_plan_members_unique on public.operational_plan_members (plan_id, username);
create index if not exists operational_plan_members_user_idx on public.operational_plan_members (lower(username)) where deleted_at is null;

alter table public.operational_tasks add column if not exists plan_id text;
-- Associar tarefas legadas ao P.O. do proprietário sem alterar os demais
-- campos. Também reconhece o nome exibido quando o legado não guardou username.
insert into public.operational_plans (id, owner_username, title)
select gen_random_uuid()::text, u.username, 'P.O. de '||coalesce(nullif(u.nome,''),u.username)
from public.usuarios u
where nullif(btrim(u.username),'') is not null
  and lower(coalesce(u.ativo::text,'sim')) not in ('nao','não','false','0','inativo')
  and not exists (select 1 from public.operational_plans p where lower(p.owner_username)=lower(u.username));
update public.operational_tasks t
set plan_id = p.id
from public.usuarios u
join public.operational_plans p on lower(p.owner_username)=lower(u.username)
where t.plan_id is null
  and (lower(btrim(coalesce(t.owner_user_key,t.assigned_user_key)))=lower(u.username)
    or lower(btrim(coalesce(t.owner_user_key,t.assigned_user_key)))=lower(u.nome));
create index if not exists operational_tasks_plan_idx on public.operational_tasks (plan_id) where deleted_at is null;

-- 3) Centro persistente de notificações.
create table if not exists public.crm_notifications (
  id text primary key default gen_random_uuid()::text,
  recipient_username text not null,
  type text not null default 'crm',
  title text not null,
  body text,
  entity_type text,
  entity_id text,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.crm_notifications add column if not exists recipient_username text;
alter table public.crm_notifications add column if not exists type text default 'crm';
alter table public.crm_notifications add column if not exists title text;
alter table public.crm_notifications add column if not exists body text;
alter table public.crm_notifications add column if not exists entity_type text;
alter table public.crm_notifications add column if not exists entity_id text;
alter table public.crm_notifications add column if not exists dedupe_key text;
alter table public.crm_notifications add column if not exists read_at timestamptz;
alter table public.crm_notifications add column if not exists created_at timestamptz default now();
create unique index if not exists crm_notifications_dedupe_unique on public.crm_notifications (recipient_username, dedupe_key);
create index if not exists crm_notifications_recipient_idx on public.crm_notifications (lower(recipient_username), read_at, created_at desc);

-- 4) Chat com título, participantes e mensagens permanentes.
create table if not exists public.crm_chat_conversations (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists public.crm_chat_participants (
  id text primary key default gen_random_uuid()::text,
  conversation_id text not null,
  username text not null,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists public.crm_chat_messages (
  id text primary key default gen_random_uuid()::text,
  conversation_id text not null,
  sender_username text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists crm_chat_participants_unique on public.crm_chat_participants (conversation_id, username);
create index if not exists crm_chat_participants_user_idx on public.crm_chat_participants (lower(username)) where deleted_at is null;
create index if not exists crm_chat_messages_conversation_idx on public.crm_chat_messages (conversation_id, created_at);

-- Helpers SECURITY DEFINER evitam recursão entre policies de plano e membro.
create or replace function public.t4_collab_is_admin()
returns boolean language sql stable security definer set search_path=public,pg_catalog
as $fn$
  select exists (
    select 1 from public.usuarios u
    where lower(u.username)=lower(public.current_username_from_auth())
      and lower(coalesce(u.role,''))='admin'
      and lower(coalesce(u.ativo::text,'sim')) not in ('nao','não','false','0','inativo')
  );
$fn$;
create or replace function public.t4_collab_plan_visible(plan_key text)
returns boolean language sql stable security definer set search_path=public,pg_catalog
as $fn$
  select exists (
    select 1 from public.operational_plans p
    where p.id=plan_key and p.deleted_at is null
      and (lower(p.owner_username)=lower(public.current_username_from_auth())
        or exists (select 1 from public.operational_plan_members m where m.plan_id=p.id and m.deleted_at is null and lower(m.username)=lower(public.current_username_from_auth())))
  );
$fn$;
create or replace function public.t4_collab_plan_manage(plan_key text)
returns boolean language sql stable security definer set search_path=public,pg_catalog
as $fn$
  select public.t4_collab_is_admin() or exists (
    select 1 from public.operational_plans p
    where p.id=plan_key and p.deleted_at is null and lower(p.owner_username)=lower(public.current_username_from_auth())
  );
$fn$;
create or replace function public.t4_collab_plan_creator(plan_key text)
returns boolean language sql stable security definer set search_path=public,pg_catalog
as $fn$
  select exists (
    select 1 from public.operational_plans p
    where p.id=plan_key and p.created_by=auth.uid()
  );
$fn$;
create or replace function public.t4_collab_plan_editable(plan_key text)
returns boolean language sql stable security definer set search_path=public,pg_catalog
as $fn$
  select public.t4_collab_is_admin() or exists (
    select 1 from public.operational_plans p
    where p.id=plan_key and p.deleted_at is null
      and lower(p.owner_username)=lower(public.current_username_from_auth())
  ) or exists (
    select 1 from public.operational_plan_members m
    where m.plan_id=plan_key and m.deleted_at is null
      and lower(m.username)=lower(public.current_username_from_auth())
      and m.permission='editor'
  );
$fn$;
create or replace function public.t4_collab_conversation_visible(conversation_key text)
returns boolean language sql stable security definer set search_path=public,pg_catalog
as $fn$
  select exists (
    select 1 from public.crm_chat_participants p
    where p.conversation_id=conversation_key and lower(p.username)=lower(public.current_username_from_auth()) and p.deleted_at is null
  );
$fn$;
create or replace function public.t4_collab_conversation_manage(conversation_key text)
returns boolean language sql stable security definer set search_path=public,pg_catalog
as $fn$
  select exists (
    select 1 from public.crm_chat_conversations c
    where c.id=conversation_key and (lower(c.created_by)=lower(public.current_username_from_auth())
      or exists (select 1 from public.crm_chat_participants p where p.conversation_id=c.id and lower(p.username)=lower(public.current_username_from_auth()) and p.role='owner' and p.deleted_at is null))
  );
$fn$;
revoke all on function public.t4_collab_is_admin() from public,anon;
revoke all on function public.t4_collab_plan_visible(text) from public,anon;
revoke all on function public.t4_collab_plan_manage(text) from public,anon;
revoke all on function public.t4_collab_plan_creator(text) from public,anon;
revoke all on function public.t4_collab_plan_editable(text) from public,anon;
revoke all on function public.t4_collab_conversation_visible(text) from public,anon;
revoke all on function public.t4_collab_conversation_manage(text) from public,anon;
grant execute on function public.t4_collab_is_admin(),public.t4_collab_plan_visible(text),public.t4_collab_plan_manage(text),public.t4_collab_plan_creator(text),public.t4_collab_plan_editable(text),public.t4_collab_conversation_visible(text),public.t4_collab_conversation_manage(text) to authenticated,service_role;

-- 5) RLS: P.O.s privados, membros explícitos e conversas por participante.
alter table public.operational_plans enable row level security;
alter table public.operational_plan_members enable row level security;
alter table public.crm_notifications enable row level security;
alter table public.crm_chat_conversations enable row level security;
alter table public.crm_chat_participants enable row level security;
alter table public.crm_chat_messages enable row level security;

revoke all on public.operational_plans,public.operational_plan_members,public.crm_notifications,public.crm_chat_conversations,public.crm_chat_participants,public.crm_chat_messages from public,anon;
grant select,insert,update on public.operational_plans to authenticated;
grant select,insert,update on public.operational_plan_members to authenticated;
grant select,insert,update on public.operational_tasks to authenticated;
grant select,update on public.crm_notifications to authenticated;
grant select,insert,update on public.crm_chat_conversations to authenticated;
grant select,insert,update on public.crm_chat_participants to authenticated;
grant select,insert on public.crm_chat_messages to authenticated;
grant all on public.operational_plans,public.operational_plan_members,public.crm_notifications,public.crm_chat_conversations,public.crm_chat_participants,public.crm_chat_messages to service_role;

drop policy if exists t4_collab_plans_read on public.operational_plans;
drop policy if exists t4_collab_plans_insert on public.operational_plans;
drop policy if exists t4_collab_plans_update on public.operational_plans;
create policy t4_collab_plans_read on public.operational_plans for select to authenticated
  using (public.t4_talents_v22_access(false) and public.t4_collab_plan_visible(id));
create policy t4_collab_plans_insert on public.operational_plans for insert to authenticated
  with check (public.t4_talents_v22_access(true) and exists (select 1 from public.usuarios u where lower(u.username)=lower(owner_username) and lower(coalesce(u.ativo::text,'sim')) not in ('nao','não','false','0','inativo')));
create policy t4_collab_plans_update on public.operational_plans for update to authenticated
  using (public.t4_talents_v22_access(true) and public.t4_collab_plan_manage(id))
  with check (public.t4_talents_v22_access(true) and public.t4_collab_plan_manage(id));

drop policy if exists t4_collab_members_read on public.operational_plan_members;
drop policy if exists t4_collab_members_insert on public.operational_plan_members;
drop policy if exists t4_collab_members_update on public.operational_plan_members;
create policy t4_collab_members_read on public.operational_plan_members for select to authenticated
  using (public.t4_talents_v22_access(false) and public.t4_collab_plan_visible(plan_id));
create policy t4_collab_members_insert on public.operational_plan_members for insert to authenticated
  with check (public.t4_talents_v22_access(true) and (public.t4_collab_plan_manage(plan_id) or public.t4_collab_plan_creator(plan_id)));
create policy t4_collab_members_update on public.operational_plan_members for update to authenticated
  using (public.t4_talents_v22_access(true) and public.t4_collab_plan_manage(plan_id))
  with check (public.t4_talents_v22_access(true) and public.t4_collab_plan_manage(plan_id));

-- Policies RESTRICTIVE tornam privado o que já existia em operational_tasks,
-- mesmo que uma policy permissiva antiga continue presente. Leitores
-- compartilhados consultam o P.O.; somente proprietário, administrador ou
-- membro com permissão editor pode gravar tarefas.
alter table public.operational_tasks enable row level security;
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
  using (public.t4_talents_v22_access(false) and (public.t4_collab_is_admin() or public.t4_collab_plan_visible(plan_id) or (plan_id is null and lower(btrim(coalesce(owner_user_key,assigned_user_key)))=lower(public.current_username_from_auth()))));
create policy t4_collab_tasks_insert on public.operational_tasks as restrictive for insert to authenticated
  with check (public.t4_talents_v22_access(true) and (public.t4_collab_plan_editable(plan_id) or (plan_id is null and (public.t4_collab_is_admin() or lower(btrim(coalesce(owner_user_key,assigned_user_key)))=lower(public.current_username_from_auth())))));
create policy t4_collab_tasks_update on public.operational_tasks as restrictive for update to authenticated
  using (public.t4_talents_v22_access(true) and (public.t4_collab_plan_editable(plan_id) or (plan_id is null and (public.t4_collab_is_admin() or lower(btrim(coalesce(owner_user_key,assigned_user_key)))=lower(public.current_username_from_auth())))))
  with check (public.t4_talents_v22_access(true) and (public.t4_collab_plan_editable(plan_id) or (plan_id is null and (public.t4_collab_is_admin() or lower(btrim(coalesce(owner_user_key,assigned_user_key)))=lower(public.current_username_from_auth())))));
create policy t4_collab_tasks_delete on public.operational_tasks as restrictive for delete to authenticated
  using (public.t4_talents_v22_access(true) and (public.t4_collab_plan_editable(plan_id) or (plan_id is null and (public.t4_collab_is_admin() or lower(btrim(coalesce(owner_user_key,assigned_user_key)))=lower(public.current_username_from_auth())))));

drop policy if exists t4_collab_notifications_read on public.crm_notifications;
drop policy if exists t4_collab_notifications_update on public.crm_notifications;
create policy t4_collab_notifications_read on public.crm_notifications for select to authenticated
  using (public.t4_talents_v22_access(false) and lower(recipient_username)=lower(public.current_username_from_auth()));
create policy t4_collab_notifications_update on public.crm_notifications for update to authenticated
  using (public.t4_talents_v22_access(false) and lower(recipient_username)=lower(public.current_username_from_auth()))
  with check (public.t4_talents_v22_access(false) and lower(recipient_username)=lower(public.current_username_from_auth()));

drop policy if exists t4_collab_conversations_read on public.crm_chat_conversations;
drop policy if exists t4_collab_conversations_insert on public.crm_chat_conversations;
drop policy if exists t4_collab_conversations_update on public.crm_chat_conversations;
create policy t4_collab_conversations_read on public.crm_chat_conversations for select to authenticated
  using (public.t4_talents_v22_access(false) and public.t4_collab_conversation_visible(id));
create policy t4_collab_conversations_insert on public.crm_chat_conversations for insert to authenticated
  with check (public.t4_talents_v22_access(true) and lower(created_by)=lower(public.current_username_from_auth()));
create policy t4_collab_conversations_update on public.crm_chat_conversations for update to authenticated
  using (public.t4_talents_v22_access(true) and public.t4_collab_conversation_manage(id))
  with check (public.t4_talents_v22_access(true) and public.t4_collab_conversation_manage(id));

drop policy if exists t4_collab_participants_read on public.crm_chat_participants;
drop policy if exists t4_collab_participants_insert on public.crm_chat_participants;
drop policy if exists t4_collab_participants_update on public.crm_chat_participants;
create policy t4_collab_participants_read on public.crm_chat_participants for select to authenticated
  using (public.t4_talents_v22_access(false) and public.t4_collab_conversation_visible(conversation_id));
create policy t4_collab_participants_insert on public.crm_chat_participants for insert to authenticated
  with check (public.t4_talents_v22_access(true) and public.t4_collab_conversation_manage(conversation_id));
create policy t4_collab_participants_update on public.crm_chat_participants for update to authenticated
  using (public.t4_talents_v22_access(true) and public.t4_collab_conversation_manage(conversation_id))
  with check (public.t4_talents_v22_access(true));

drop policy if exists t4_collab_messages_read on public.crm_chat_messages;
drop policy if exists t4_collab_messages_insert on public.crm_chat_messages;
create policy t4_collab_messages_read on public.crm_chat_messages for select to authenticated
  using (public.t4_talents_v22_access(false) and public.t4_collab_conversation_visible(conversation_id));
create policy t4_collab_messages_insert on public.crm_chat_messages for insert to authenticated
  with check (public.t4_talents_v22_access(true) and lower(sender_username)=lower(public.current_username_from_auth()) and public.t4_collab_conversation_visible(conversation_id));

-- 6) Eventos que geram notificações. A deduplicação mantém uma notificação
-- por entidade/usuário, sem polling agressivo no navegador.
create or replace function public.t4_collab_add_notification(recipient text, kind text, heading text, copy text, entity_kind text, entity_key text, dedupe text)
returns void language plpgsql security definer set search_path=public,pg_catalog
as $fn$
begin
  if nullif(btrim(recipient),'') is null or lower(recipient)=lower(public.current_username_from_auth()) then return; end if;
  insert into public.crm_notifications(recipient_username,type,title,body,entity_type,entity_id,dedupe_key)
  values (recipient,coalesce(kind,'crm'),coalesce(heading,'Atualização no CRM'),copy,entity_kind,entity_key,dedupe)
  on conflict (recipient_username,dedupe_key) do nothing;
end;
$fn$;
revoke all on function public.t4_collab_add_notification(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.t4_collab_add_notification(text,text,text,text,text,text,text) to service_role;

create or replace function public.t4_collab_notify_plan_member()
returns trigger language plpgsql security definer set search_path=public,pg_catalog
as $fn$
declare plan_title text;
begin
  select title into plan_title from public.operational_plans where id=new.plan_id;
  perform public.t4_collab_add_notification(new.username,'po','P.O. compartilhado',coalesce(plan_title,'Um P.O. operacional')||' foi compartilhado com você.','operational_plan',new.plan_id,'po-member:'||new.plan_id||':'||new.username);
  return new;
end;
$fn$;

create or replace function public.t4_collab_notify_task()
returns trigger language plpgsql security definer set search_path=public,pg_catalog
as $fn$
declare recipient text; task_title text;
begin
  task_title=coalesce(new.title,'Nova tarefa operacional');
  for recipient in
    select p.owner_username from public.operational_plans p where p.id=new.plan_id
    union select m.username from public.operational_plan_members m where m.plan_id=new.plan_id and m.deleted_at is null
  loop
    perform public.t4_collab_add_notification(recipient,'po','Nova pendência no P.O.',task_title,'operational_task',new.id::text,'po-task:'||new.id::text||':'||recipient);
  end loop;
  return new;
end;
$fn$;

create or replace function public.t4_collab_notify_activity()
returns trigger language plpgsql security definer set search_path=public,pg_catalog
as $fn$
begin
  perform public.t4_collab_add_notification(new.owner_username,'agenda','Nova atividade na agenda',coalesce(new.title,'Uma atividade foi adicionada à agenda.'),'crm_activity',new.id::text,'activity:'||new.id::text||':'||coalesce(new.owner_username,''));
  return new;
end;
$fn$;

create or replace function public.t4_collab_notify_meeting()
returns trigger language plpgsql security definer set search_path=public,pg_catalog
as $fn$
declare recipient text;
begin
  select u.username into recipient from public.usuarios u where lower(u.username)=lower(new.owner_name) or lower(u.nome)=lower(new.owner_name) limit 1;
  perform public.t4_collab_add_notification(recipient,'reuniao','Nova reunião adicionada',coalesce(new.title,new.topic,'Uma reunião foi adicionada.'),'organizational_meeting',new.id::text,'meeting:'||new.id::text||':'||coalesce(recipient,''));
  return new;
end;
$fn$;

create or replace function public.t4_collab_notify_summary()
returns trigger language plpgsql security definer set search_path=public,pg_catalog
as $fn$
declare recipient text;
begin
  select u.username into recipient from public.usuarios u where lower(u.username)=lower(new.owner_name) or lower(u.nome)=lower(new.owner_name) limit 1;
  perform public.t4_collab_add_notification(recipient,'resumo','Novo resumo mensal',coalesce(new.what_was_done,new.next_action,'Um resumo foi adicionado.'),'organizational_summary',new.id::text,'summary:'||new.id::text||':'||coalesce(recipient,''));
  return new;
end;
$fn$;

create or replace function public.t4_collab_notify_chat_message()
returns trigger language plpgsql security definer set search_path=public,pg_catalog
as $fn$
declare recipient text; conversation_title text;
begin
  update public.crm_chat_conversations
  set updated_at=coalesce(new.created_at,now())
  where id=new.conversation_id;
  select title into conversation_title from public.crm_chat_conversations where id=new.conversation_id;
  for recipient in select p.username from public.crm_chat_participants p where p.conversation_id=new.conversation_id and p.username<>new.sender_username and p.deleted_at is null loop
    perform public.t4_collab_add_notification(recipient,'chat','Nova mensagem no chat',coalesce(conversation_title,'Conversa')||' · '||left(new.body,120),'chat_conversation',new.conversation_id,'chat:'||new.id::text||':'||recipient);
  end loop;
  return new;
end;
$fn$;

do $trigger$
begin
  if to_regclass('public.operational_plan_members') is not null then
    execute 'drop trigger if exists t4_collab_plan_member_notify on public.operational_plan_members';
    execute 'create trigger t4_collab_plan_member_notify after insert on public.operational_plan_members for each row execute function public.t4_collab_notify_plan_member()';
  end if;
  if to_regclass('public.operational_tasks') is not null then
    execute 'drop trigger if exists t4_collab_task_notify on public.operational_tasks';
    execute 'create trigger t4_collab_task_notify after insert on public.operational_tasks for each row execute function public.t4_collab_notify_task()';
  end if;
  if to_regclass('public.crm_activities') is not null then
    execute 'drop trigger if exists t4_collab_activity_notify on public.crm_activities';
    execute 'create trigger t4_collab_activity_notify after insert on public.crm_activities for each row execute function public.t4_collab_notify_activity()';
  end if;
  if to_regclass('public.organizational_meetings') is not null then
    execute 'drop trigger if exists t4_collab_meeting_notify on public.organizational_meetings';
    execute 'create trigger t4_collab_meeting_notify after insert on public.organizational_meetings for each row execute function public.t4_collab_notify_meeting()';
  end if;
  if to_regclass('public.organizational_weekly_summaries') is not null then
    execute 'drop trigger if exists t4_collab_summary_notify on public.organizational_weekly_summaries';
    execute 'create trigger t4_collab_summary_notify after insert on public.organizational_weekly_summaries for each row execute function public.t4_collab_notify_summary()';
  end if;
  if to_regclass('public.crm_chat_messages') is not null then
    execute 'drop trigger if exists t4_collab_chat_message_notify on public.crm_chat_messages';
    execute 'create trigger t4_collab_chat_message_notify after insert on public.crm_chat_messages for each row execute function public.t4_collab_notify_chat_message()';
  end if;
end;
$trigger$;

-- Realtime somente nas tabelas pequenas de colaboração; as listas grandes
-- continuam paginadas e sem polling frequente.
do $realtime$
declare target text;
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    foreach target in array array['crm_notifications','crm_chat_conversations','crm_chat_participants','crm_chat_messages'] loop
      if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=target) then
        execute format('alter publication supabase_realtime add table public.%I',target);
      end if;
    end loop;
  end if;
end;
$realtime$;

do $verify$
declare target text;
begin
  foreach target in array array['operational_plans','operational_plan_members','crm_notifications','crm_chat_conversations','crm_chat_participants','crm_chat_messages'] loop
    if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||target)) then
      raise exception 'RLS não está ativo em %.',target;
    end if;
    if has_table_privilege('anon','public.'||target,'SELECT') then
      raise exception 'anon ainda possui SELECT em %.',target;
    end if;
  end loop;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='candidatos' and column_name='crm_scope') then
    raise exception 'candidatos.crm_scope não foi criado.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='operational_tasks' and column_name='plan_id') then
    raise exception 'operational_tasks.plan_id não foi criado.';
  end if;
end;
$verify$;

notify pgrst,'reload schema';
commit;

-- Verificação manual recomendada após aplicar em homologação:
-- select crm_scope,count(*) from public.candidatos group by crm_scope;
-- select p.owner_username,count(m.id) as compartilhamentos
-- from public.operational_plans p left join public.operational_plan_members m on m.plan_id=p.id and m.deleted_at is null
-- group by p.owner_username order by p.owner_username;
