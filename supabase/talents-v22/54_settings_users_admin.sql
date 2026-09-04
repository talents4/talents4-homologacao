-- TALENTS 4 · CONFIGURAÇÕES: IDIOMA DO SISTEMA E ADMINISTRAÇÃO DE USUÁRIOS
--
-- Aplicar manualmente em homologação depois da 50_crm_collaboration_scope.sql
-- (usa o helper t4_collab_is_admin criado lá). Esta migração é aditiva: não
-- apaga nem altera nenhuma policy existente de public.usuarios — ela é uma
-- tabela pré-existente, fora desta pasta de migrações, cuja policy atual de
-- "cada um vê/edita a própria linha" não é conhecida por este script e por
-- isso nunca é tocada (nem um DROP POLICY é emitido contra ela). O que esta
-- migração faz é ADICIONAR novas policies PERMISSIVE, exclusivas para quem
-- já é administrador (role='admin'): como policies permissivas se somam com
-- OR sobre a mesma tabela, isso só AMPLIA o acesso de administradores,
-- nunca reduz o que já existia para os demais usuários.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preconditions$
begin
  if to_regclass('public.usuarios') is null
    or to_regprocedure('public.current_username_from_auth()') is null
    or to_regprocedure('public.t4_talents_v22_access(boolean)') is null
    or to_regprocedure('public.t4_collab_is_admin()') is null then
    raise exception 'Base V2/colaboração ausente. Aplique a V2 e a migração 50 antes desta.';
  end if;
  if not (select relrowsecurity from pg_class where oid=to_regclass('public.usuarios')) then
    raise exception 'RLS não está ativo em public.usuarios — não prossiga sem confirmar o schema primeiro.';
  end if;
end;
$preconditions$;

-- 1) Preferência de idioma do sistema: uma única linha, editável só por
-- administradores, lida por qualquer usuário autenticado (precisa saber em
-- qual idioma desenhar a interface antes mesmo de decidir o que mais pode
-- ver). Guardado como chave/valor para caber outras preferências no futuro
-- sem nova migração.
create table if not exists public.t4_system_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.t4_system_settings add column if not exists value text;
alter table public.t4_system_settings add column if not exists updated_at timestamptz default now();
alter table public.t4_system_settings add column if not exists updated_by text;
insert into public.t4_system_settings (key, value)
values ('language', 'pt')
on conflict (key) do nothing;

alter table public.t4_system_settings enable row level security;
revoke all on public.t4_system_settings from public,anon;
grant select on public.t4_system_settings to authenticated;
grant update on public.t4_system_settings to authenticated;
grant all on public.t4_system_settings to service_role;

drop policy if exists t4_settings_read on public.t4_system_settings;
drop policy if exists t4_settings_admin_write on public.t4_system_settings;
create policy t4_settings_read on public.t4_system_settings for select to authenticated
  using (public.t4_talents_v22_access(false));
create policy t4_settings_admin_write on public.t4_system_settings for update to authenticated
  using (public.t4_talents_v22_access(false) and public.t4_collab_is_admin())
  with check (public.t4_talents_v22_access(false) and public.t4_collab_is_admin());

-- 2) Administração de usuários: administradores passam a enxergar e editar
-- QUALQUER linha de usuarios (nome, papel, status), além da própria — a
-- criação e a exclusão real de contas de login continuam fora do alcance
-- do RLS (exigem a chave de serviço; ver supabase/functions/admin-users).
-- Nomes de policy exclusivos (prefixo t4_settings_) para nunca colidir com
-- policies pré-existentes de mesmo nome nesta tabela.
drop policy if exists t4_settings_users_admin_read on public.usuarios;
drop policy if exists t4_settings_users_admin_write on public.usuarios;
create policy t4_settings_users_admin_read on public.usuarios for select to authenticated
  using (public.t4_talents_v22_access(false) and public.t4_collab_is_admin());
create policy t4_settings_users_admin_write on public.usuarios for update to authenticated
  using (public.t4_talents_v22_access(false) and public.t4_collab_is_admin())
  with check (public.t4_talents_v22_access(false) and public.t4_collab_is_admin());

notify pgrst,'reload schema';

do $verify$
begin
  if not exists (select 1 from public.t4_system_settings where key='language') then
    raise exception 'Configuração de idioma padrão não foi criada.';
  end if;
  if not (select relrowsecurity from pg_class where oid=to_regclass('public.t4_system_settings')) then
    raise exception 'RLS não está ativo em t4_system_settings.';
  end if;
  if has_table_privilege('anon','public.t4_system_settings','SELECT') then
    raise exception 'anon ainda possui SELECT em t4_system_settings.';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='usuarios' and policyname='t4_settings_users_admin_read') then
    raise exception 'Policy de leitura administrativa de usuarios não foi criada.';
  end if;
end;
$verify$;

commit;

-- Verificação manual recomendada após aplicar em homologação:
-- 1. Como um usuário SEM role='admin', confirme que a leitura/edição de
--    OUTRAS pessoas continua bloqueada (só sua própria linha, como já era).
-- 2. Como administrador, confirme que agora aparecem todas as linhas de
--    usuarios e que é possível atualizar nome/role/ativo de qualquer uma.
-- 3. select * from public.t4_system_settings; -- deve retornar a linha 'language'.
