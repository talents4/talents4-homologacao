-- TALENTOS 2.2 · APLICAÇÃO MANUAL, SOMENTE APÓS APROVAR O PREFLIGHT.
-- Não executar no banco compartilhado apenas para experimentar a interface.
-- Não importa planilhas, não regrava registros antigos, não altera RLS existente.
-- Recusa tabelas/funções homônimas: não é um script para reaplicar por tentativa.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ultima_atualizacao aceita text/character varying além dos tipos de data:
-- a auditoria de 2026-09-03 (docs/auditoria/AUDITORIA_SUPABASE_INTEGRACAO.md)
-- confirmou que a coluna real é `text`, não timestamp. Nada neste script usa
-- o tipo dessa coluna para calcular algo — a checagem original só existia
-- para constatar que a coluna existe com um tipo administrável; recusá-la
-- por ser text bloquearia a migração inteira sem motivo real.
do $preconditions$
declare r record; actual_type text; target text;
begin
  for r in select * from (values
    ('candidatos','id',array['text']),('candidatos','nome_completo',array['text','character varying']),
    ('candidatos','ultima_atualizacao',array['timestamp with time zone','timestamp without time zone','text','character varying']),
    ('employers','id',array['uuid']),('employer_openings','id',array['uuid']),
    ('employer_openings','employer_id',array['text','uuid']),
    ('usuarios','username',array['text','character varying']),('usuarios','ativo',array['text','character varying']),
    ('usuarios','role',array['text','character varying']),('usuarios','auth_uid',array['uuid'])
  ) x(table_name,column_name,accepted_types) loop
    select data_type into actual_type from information_schema.columns
      where table_schema='public' and table_name=r.table_name and column_name=r.column_name;
    if actual_type is null or not actual_type=any(r.accepted_types) then
      raise exception 'Pré-requisito incompatível: %.% (%)',r.table_name,r.column_name,actual_type;
    end if;
  end loop;
  foreach target in array array['candidatos','employers','employer_openings','usuarios'] loop
    if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||target)) then
      raise exception 'RLS precisa estar ativo no pré-requisito: %',target;
    end if;
  end loop;
  if to_regprocedure('public.can_edit_crm()') is null or to_regprocedure('public.current_username_from_auth()') is null or to_regprocedure('auth.uid()') is null then
    raise exception 'Função de autenticação necessária ausente';
  end if;
  foreach target in array array['talent_mapping_profiles','talent_mapping_items','talent_mapping_partners'] loop
    if to_regclass('public.'||target) is not null then raise exception 'Objeto já existe: %. Não reaplicar; revisar a versão.',target; end if;
  end loop;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 't4_talents_v22_%') then
    raise exception 'Já existem funções desta revisão. Não serão sobrescritas.';
  end if;
  for r in select * from (values
    ('idade',array['text','character varying','integer','numeric']),('area_profissional',array['text','character varying']),
    ('nivel_alemao',array['text','character varying']),('cv_drive_web_link',array['text','character varying']),
    ('experiencia_profissional_tempo',array['text','character varying']),('perfil_profissional_para_apresentacao',array['text','character varying']),
    ('pronto_para_employer',array['text','character varying','boolean']),('lingua_estrangeira',array['text','character varying']),
    ('nivel_lingua_estrangeira',array['text','character varying'])
  ) x(column_name,accepted_types) loop
    select data_type into actual_type from information_schema.columns
      where table_schema='public' and table_name='candidatos' and column_name=r.column_name;
    if actual_type is not null and not actual_type=any(r.accepted_types) then raise exception 'Tipo existente não será convertido: candidatos.% (%)',r.column_name,actual_type; end if;
  end loop;
end;
$preconditions$;

-- Reutilizar o campo canônico. Adicionar somente se ele realmente não existe.
alter table public.candidatos
  add column if not exists idade text,
  add column if not exists area_profissional text,
  add column if not exists nivel_alemao text,
  add column if not exists cv_drive_web_link text,
  add column if not exists experiencia_profissional_tempo text,
  add column if not exists perfil_profissional_para_apresentacao text,
  add column if not exists pronto_para_employer text,
  add column if not exists lingua_estrangeira text,
  add column if not exists nivel_lingua_estrangeira text;

create table public.talent_mapping_partners (
  id uuid primary key references public.employers(id) on delete cascade,
  is_nectanet text check (is_nectanet in ('Sim','Não')),
  source text, ceo_name text, ceo_email text, hr_name text, hr_email text,
  contact_status text, notes text, send_email text, sector text, description text, openings_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid default auth.uid()
);
create table public.talent_mapping_items (
  id uuid primary key default gen_random_uuid(),
  talent_id text not null references public.candidatos(id) on delete cascade,
  employer_id uuid references public.employers(id), employer_name text,
  opening_id uuid references public.employer_openings(id),
  source_table text check (source_table in ('talent_opportunity_matches','candidate_employer_matches','candidate_employer_links')),
  source_record_id text,
  nectanet text check (nectanet in ('Sim','Não')), vacancy_status text,
  professional_score numeric(5,2) check (professional_score between 0 and 100),
  current_viability_score numeric(5,2) check (current_viability_score between 0 and 100),
  projected_b1_score numeric(5,2) check (projected_b1_score between 0 and 100),
  vacancy_situation text, type_area text, fit_reasons text, barriers text,
  language_requirement text, recognition_requirement text, location text, contact text,
  official_url text check (official_url is null or official_url ~* '^https?://[^/?#@[:space:]]+([/?#][^[:space:]]*)?$'),
  verified_on date, verification_notes text, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid default auth.uid(),
  constraint tm22_target_required check (employer_id is not null or nullif(btrim(employer_name),'') is not null),
  constraint tm22_source_pair check ((source_table is null) = (source_record_id is null)),
  constraint tm22_source_nonempty check (source_record_id is null or btrim(source_record_id)<>''),
  constraint tm22_source_unique unique (source_table,source_record_id),
  constraint tm22_talent_item_unique unique (talent_id,id)
);
create table public.talent_mapping_profiles (
  id text primary key references public.candidatos(id) on delete cascade,
  lista_nectanet text check (lista_nectanet in ('Sim','Não')), visto text,
  profissional_qualificado text, novo_cv text, cluster text, ingles text, outros_idiomas text,
  employer_primary_id uuid references public.employers(id),
  employer_alt1_id uuid references public.employers(id),
  employer_alt2_id uuid references public.employers(id),
  observacao_apresentacao text, perfil_titulo text, perfil_comprovado text, idiomas_contexto text,
  regra_revisao text, premissa_projecao text, barreira_principal text, prioridade_mapeamento text,
  best_nectanet_item_id uuid, best_external_item_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(), updated_by uuid default auth.uid(),
  constraint tm22_distinct_targets check (
    (employer_primary_id is null or employer_alt1_id is null or employer_primary_id<>employer_alt1_id)
    and (employer_primary_id is null or employer_alt2_id is null or employer_primary_id<>employer_alt2_id)
    and (employer_alt1_id is null or employer_alt2_id is null or employer_alt1_id<>employer_alt2_id)),
  constraint tm22_best_nectanet_own foreign key (id,best_nectanet_item_id) references public.talent_mapping_items(talent_id,id) deferrable initially deferred,
  constraint tm22_best_external_own foreign key (id,best_external_item_id) references public.talent_mapping_items(talent_id,id) deferrable initially deferred
);
create index tm22_items_talent on public.talent_mapping_items(talent_id) where archived_at is null;
create index tm22_items_employer on public.talent_mapping_items(employer_id) where archived_at is null;
create index tm22_items_opening on public.talent_mapping_items(opening_id) where opening_id is not null;
create unique index tm22_items_unique_opening on public.talent_mapping_items(talent_id,opening_id) where opening_id is not null and archived_at is null;

-- Sem fallback viewer: exige perfil interno ativo e identidade compatível.
-- SECURITY INVOKER também respeita a política existente de usuarios.
create function public.t4_talents_v22_access(write_access boolean default false)
returns boolean language sql stable security invoker set search_path=pg_catalog
as $fn$
  select auth.uid() is not null and exists (
    select 1 from public.usuarios u
    where lower(u.username)=lower(public.current_username_from_auth())
      and (u.auth_uid is null or u.auth_uid=auth.uid())
      and upper(coalesce(u.ativo,'SIM'))='SIM'
      and u.role=any(case when write_access then array['admin','recrutador'] else array['admin','recrutador','viewer'] end)
      and (not write_access or public.can_edit_crm())
  );
$fn$;
revoke all on function public.t4_talents_v22_access(boolean) from public,anon;
grant execute on function public.t4_talents_v22_access(boolean) to authenticated,service_role;

create function public.t4_talents_v22_touch()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $fn$
begin
  if tg_op='UPDATE' then
    if new.id is distinct from old.id then raise exception 'A identidade do registro não pode ser alterada'; end if;
    new.created_at=old.created_at; new.created_by=old.created_by;
  else
    new.created_at=clock_timestamp(); new.created_by=auth.uid();
  end if;
  new.updated_at=clock_timestamp(); new.updated_by=auth.uid();
  return new;
end;
$fn$;

create function public.t4_talents_v22_check_item()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $fn$
declare linked_employer text; origin jsonb;
begin
  if tg_op='UPDATE' then
    if new.talent_id is distinct from old.talent_id or new.source_table is distinct from old.source_table or new.source_record_id is distinct from old.source_record_id then
      raise exception 'Não é permitido transferir o acompanhamento nem trocar sua origem';
    end if;
  end if;
  if new.employer_id is not null and not exists(select 1 from public.employers e where e.id=new.employer_id) then
    raise exception 'Empregador inexistente ou não visível';
  end if;
  if new.opening_id is not null then
    select o.employer_id::text into linked_employer from public.employer_openings o where o.id=new.opening_id;
    if linked_employer is null or new.employer_id::text is distinct from linked_employer then raise exception 'Vaga inexistente, não visível ou pertencente a outro empregador'; end if;
  end if;
  if new.source_table is not null then
    if new.source_table not in ('talent_opportunity_matches','candidate_employer_matches','candidate_employer_links') then raise exception 'Origem inválida'; end if;
    execute format('select to_jsonb(s) from public.%I s where s.id::text=$1',new.source_table) into origin using new.source_record_id;
    if origin is null or coalesce(origin->>'talent_id',origin->>'candidato_id',origin->>'candidate_id') is distinct from new.talent_id
      or coalesce(origin->>'employer_id',origin->>'empregador_id') is distinct from new.employer_id::text then
      raise exception 'A linha deve corresponder ao Talento e empregador da origem visível';
    end if;
    if new.source_table='talent_opportunity_matches' and origin->>'opening_id' is distinct from new.opening_id::text then raise exception 'A vaga deve ser a mesma da seleção original'; end if;
  end if;
  return new;
end;
$fn$;
create function public.t4_talents_v22_check_profile()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $fn$
declare target uuid; best uuid; previous_best uuid; expected text; entry record;
begin
  foreach target in array array[new.employer_primary_id,new.employer_alt1_id,new.employer_alt2_id] loop
    if target is not null and not exists(select 1 from public.employers e where e.id=target) then
      raise exception 'Empresa de apresentação inexistente ou não visível';
    end if;
  end loop;
  foreach expected in array array['Sim','Não'] loop
    best=case when expected='Sim' then new.best_nectanet_item_id else new.best_external_item_id end;
    if best is null then continue; end if;
    if tg_op='UPDATE' then
      previous_best=case when expected='Sim' then old.best_nectanet_item_id else old.best_external_item_id end;
      if best is not distinct from previous_best then continue; end if;
    end if;
    select i.talent_id,i.archived_at,coalesce(i.nectanet,p.is_nectanet) as nectanet into entry
      from public.talent_mapping_items i left join public.talent_mapping_partners p on p.id=i.employer_id where i.id=best;
    if not found or entry.talent_id is distinct from new.id or entry.archived_at is not null or entry.nectanet is distinct from expected then
      raise exception 'Melhor alvo deve pertencer ao Talento, estar ativo e corresponder à categoria NectaNet/BW externa';
    end if;
  end loop;
  return new;
end;
$fn$;
revoke all on function public.t4_talents_v22_touch() from public,anon,authenticated;
revoke all on function public.t4_talents_v22_check_item() from public,anon,authenticated;
revoke all on function public.t4_talents_v22_check_profile() from public,anon,authenticated;

create trigger tm22_items_validate before insert or update on public.talent_mapping_items for each row execute function public.t4_talents_v22_check_item();
create trigger tm22_items_touch before insert or update on public.talent_mapping_items for each row execute function public.t4_talents_v22_touch();
create trigger tm22_profiles_touch before insert or update on public.talent_mapping_profiles for each row execute function public.t4_talents_v22_touch();
create trigger tm22_profiles_validate before insert or update on public.talent_mapping_profiles for each row execute function public.t4_talents_v22_check_profile();
create trigger tm22_partners_touch before insert or update on public.talent_mapping_partners for each row execute function public.t4_talents_v22_touch();

alter table public.talent_mapping_profiles enable row level security;
alter table public.talent_mapping_items enable row level security;
alter table public.talent_mapping_partners enable row level security;
revoke all on public.talent_mapping_profiles,public.talent_mapping_items,public.talent_mapping_partners from public,anon,authenticated;
grant select,insert,update on public.talent_mapping_profiles,public.talent_mapping_items,public.talent_mapping_partners to authenticated;
grant all on public.talent_mapping_profiles,public.talent_mapping_items,public.talent_mapping_partners to service_role;

create policy tm22_profiles_read on public.talent_mapping_profiles for select to authenticated
  using (public.t4_talents_v22_access(false) and exists(select 1 from public.candidatos c where c.id=talent_mapping_profiles.id));
create policy tm22_profiles_insert on public.talent_mapping_profiles for insert to authenticated
  with check (public.t4_talents_v22_access(true) and exists(select 1 from public.candidatos c where c.id=talent_mapping_profiles.id));
create policy tm22_profiles_update on public.talent_mapping_profiles for update to authenticated
  using (public.t4_talents_v22_access(true) and exists(select 1 from public.candidatos c where c.id=talent_mapping_profiles.id))
  with check (public.t4_talents_v22_access(true) and exists(select 1 from public.candidatos c where c.id=talent_mapping_profiles.id));
create policy tm22_items_read on public.talent_mapping_items for select to authenticated
  using (public.t4_talents_v22_access(false) and exists(select 1 from public.candidatos c where c.id=talent_id));
create policy tm22_items_insert on public.talent_mapping_items for insert to authenticated
  with check (public.t4_talents_v22_access(true) and exists(select 1 from public.candidatos c where c.id=talent_id));
create policy tm22_items_update on public.talent_mapping_items for update to authenticated
  using (public.t4_talents_v22_access(true) and exists(select 1 from public.candidatos c where c.id=talent_id))
  with check (public.t4_talents_v22_access(true) and exists(select 1 from public.candidatos c where c.id=talent_id));
create policy tm22_partners_read on public.talent_mapping_partners for select to authenticated
  using (public.t4_talents_v22_access(false) and exists(select 1 from public.employers e where e.id=talent_mapping_partners.id));
create policy tm22_partners_insert on public.talent_mapping_partners for insert to authenticated
  with check (public.t4_talents_v22_access(true) and exists(select 1 from public.employers e where e.id=talent_mapping_partners.id));
create policy tm22_partners_update on public.talent_mapping_partners for update to authenticated
  using (public.t4_talents_v22_access(true) and exists(select 1 from public.employers e where e.id=talent_mapping_partners.id))
  with check (public.t4_talents_v22_access(true) and exists(select 1 from public.employers e where e.id=talent_mapping_partners.id));

-- Verificação de privilégios dentro da mesma transação: falha desfaz tudo.
do $verify$
declare target text;
begin
  foreach target in array array['talent_mapping_profiles','talent_mapping_items','talent_mapping_partners'] loop
    if has_table_privilege('anon','public.'||target,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_table_privilege('authenticated','public.'||target,'DELETE,TRUNCATE,TRIGGER')
      or not (select relrowsecurity from pg_class where oid=to_regclass('public.'||target)) then
      raise exception 'Verificação de segurança reprovada em %',target;
    end if;
  end loop;
end;
$verify$;
notify pgrst,'reload schema';
commit;
