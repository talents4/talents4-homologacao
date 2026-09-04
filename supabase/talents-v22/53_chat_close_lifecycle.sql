-- TALENTS 4 · ENCERRAMENTO DE CONVERSAS DO CHAT
--
-- Aplicar manualmente em homologação depois da 50_crm_collaboration_scope.sql
-- e da 51_fix_chat_creation_permissions.sql. Esta migração é aditiva: não
-- apaga conversas, participantes nem mensagens. Adiciona um estado de
-- encerramento por conversa (closed_at/closed_by) e torna a conversa
-- somente leitura no banco a partir do encerramento — título, participantes
-- e novas mensagens passam a ser bloqueados nas próprias policies, não só
-- na interface.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preconditions$
begin
  if to_regclass('public.crm_chat_conversations') is null
    or to_regclass('public.crm_chat_participants') is null
    or to_regclass('public.crm_chat_messages') is null
    or to_regprocedure('public.current_username_from_auth()') is null
    or to_regprocedure('public.t4_talents_v22_access(boolean)') is null
    or to_regprocedure('public.t4_collab_conversation_manage(text)') is null then
    raise exception 'A colaboração ainda não está instalada. Aplique 50_crm_collaboration_scope.sql e 51_fix_chat_creation_permissions.sql antes desta migração.';
  end if;
end;
$preconditions$;

alter table public.crm_chat_conversations add column if not exists closed_at timestamptz;
alter table public.crm_chat_conversations add column if not exists closed_by text;
create index if not exists crm_chat_conversations_open_idx on public.crm_chat_conversations (closed_at) where deleted_at is null;

-- SECURITY DEFINER pelo mesmo motivo dos demais helpers de colaboração:
-- evita recursão das policies ao consultar a própria tabela de conversas
-- a partir das policies de participantes e mensagens.
create or replace function public.t4_collab_conversation_open(conversation_key text)
returns boolean language sql stable security definer set search_path=public,pg_catalog
as $fn$
  select coalesce((
    select c.closed_at is null
    from public.crm_chat_conversations c
    where c.id=conversation_key and c.deleted_at is null
  ), false);
$fn$;
revoke all on function public.t4_collab_conversation_open(text) from public,anon;
grant execute on function public.t4_collab_conversation_open(text) to authenticated,service_role;

-- UPDATE em crm_chat_conversations passa a exigir a conversa aberta na linha
-- ANTES da alteração (USING avalia a linha existente) — isso cobre o próprio
-- encerramento (ainda aberta ao ser fechada) e bloqueia qualquer update
-- posterior, incluindo tentativa de reabrir: encerrar é definitivo.
drop policy if exists t4_collab_conversations_update on public.crm_chat_conversations;
create policy t4_collab_conversations_update on public.crm_chat_conversations for update to authenticated
  using (public.t4_talents_v22_access(true) and public.t4_collab_conversation_manage(id) and closed_at is null)
  with check (public.t4_talents_v22_access(true) and public.t4_collab_conversation_manage(id));

drop policy if exists t4_collab_participants_insert on public.crm_chat_participants;
drop policy if exists t4_collab_participants_update on public.crm_chat_participants;
create policy t4_collab_participants_insert on public.crm_chat_participants for insert to authenticated
  with check (public.t4_talents_v22_access(true) and public.t4_collab_conversation_manage(conversation_id) and public.t4_collab_conversation_open(conversation_id));
create policy t4_collab_participants_update on public.crm_chat_participants for update to authenticated
  using (public.t4_talents_v22_access(true) and public.t4_collab_conversation_manage(conversation_id) and public.t4_collab_conversation_open(conversation_id))
  with check (public.t4_talents_v22_access(true));

drop policy if exists t4_collab_messages_insert on public.crm_chat_messages;
create policy t4_collab_messages_insert on public.crm_chat_messages for insert to authenticated
  with check (public.t4_talents_v22_access(true) and lower(sender_username)=lower(public.current_username_from_auth()) and public.t4_collab_conversation_visible(conversation_id) and public.t4_collab_conversation_open(conversation_id));

notify pgrst,'reload schema';

do $verify$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='crm_chat_conversations' and column_name='closed_at') then
    raise exception 'crm_chat_conversations.closed_at não foi criado.';
  end if;
  if not exists (select 1 from pg_proc where proname='t4_collab_conversation_open' and pronamespace='public'::regnamespace) then
    raise exception 'Helper t4_collab_conversation_open não foi criado.';
  end if;
end;
$verify$;

commit;

-- Verificação manual recomendada após aplicar em homologação:
-- update public.crm_chat_conversations set closed_at=now(), closed_by='<username>' where id='<id>';
-- (deve funcionar para o dono/criador) e então tentar de novo (deve falhar:
-- a linha já não satisfaz mais USING closed_at is null).
