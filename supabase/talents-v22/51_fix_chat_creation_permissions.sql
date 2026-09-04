-- TALENTS 4 · CORREÇÃO DA CRIAÇÃO DO CHAT
--
-- Aplicar manualmente em homologação depois da 50_crm_collaboration_scope.sql.
-- A primeira versão permitia inserir a conversa, mas a policy de leitura só
-- reconhecia participantes. Como o frontend usava INSERT ... RETURNING antes
-- de inserir o proprietário, o próprio criador recebia 42501.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preconditions$
begin
  if to_regclass('public.crm_chat_conversations') is null
    or to_regclass('public.crm_chat_participants') is null
    or to_regprocedure('public.current_username_from_auth()') is null
    or to_regprocedure('public.t4_talents_v22_access(boolean)') is null then
    raise exception 'A colaboração ainda não está instalada. Aplique 50_crm_collaboration_scope.sql antes desta correção.';
  end if;
end;
$preconditions$;

-- O criador é um participante lógico desde a inclusão da conversa. Isso
-- permite RETURNING, leitura de conversas órfãs geradas pela versão anterior
-- e envio de mensagens sem abrir o chat para outros usuários.
create or replace function public.t4_collab_conversation_visible(conversation_key text)
returns boolean language sql stable security definer set search_path=public,pg_catalog
as $fn$
  select exists (
    select 1 from public.crm_chat_conversations c
    where c.id=conversation_key and c.deleted_at is null
      and (lower(c.created_by)=lower(public.current_username_from_auth())
        or exists (
          select 1 from public.crm_chat_participants p
          where p.conversation_id=c.id
            and lower(p.username)=lower(public.current_username_from_auth())
            and p.deleted_at is null
        ))
  );
$fn$;

notify pgrst,'reload schema';
commit;
