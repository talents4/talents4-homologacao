-- Talents 4 · importação controlada — tabelas de staging.
-- APLICAÇÃO MANUAL, SOMENTE APÓS 01_schema_additive.sql.
-- Cria 4 tabelas novas (import_batches, import_source_records, import_rows,
-- import_errors). Não insere nenhuma linha, não toca em candidatos/
-- employers/talent_mapping_*. Reaproveita a função de autorização já criada
-- por supabase/talents-v22/10_additive.sql (public.t4_talents_v22_access) —
-- não duplica lógica de permissão.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preconditions$
declare target text;
begin
  foreach target in array array['import_batches','import_source_records','import_rows','import_errors'] loop
    if to_regclass('public.'||target) is not null then raise exception 'Objeto já existe: %. Não reaplicar; revisar estrutura.', target; end if;
  end loop;
  if to_regprocedure('public.t4_talents_v22_access(boolean)') is null then
    raise exception 'Função public.t4_talents_v22_access(boolean) ausente. Aplique primeiro supabase/talents-v22/10_additive.sql (ela é reaproveitada aqui, não duplicada).';
  end if;
end;
$preconditions$;

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'staged' check (status in ('staged','previewed','confirmed','applied','partially_applied','rolled_back','aborted')),
  source_files jsonb not null,          -- [{filename, sha256, size_bytes}, ...] — identifica exatamente qual arquivo gerou o lote
  expected_counts jsonb,                 -- contagens vistas na prévia, antes de aplicar
  actual_counts jsonb,                   -- contagens reais depois de aplicar (05_verify_import.sql compara os dois)
  safety_limit integer not null default 200 check (safety_limit > 0),  -- 04_apply_import.sql aborta se a contagem real ultrapassar isto; 200 é o limite pedido explicitamente ("não crie mais de 200 registros por acidente"), configurável por lote se um caso legítimo precisar de mais
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  applied_at timestamptz,
  applied_by uuid,
  rolled_back_at timestamptz,
  rolled_back_by uuid
);

create table public.import_source_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  source_file text not null,
  source_sheet text not null,
  source_row integer not null,
  raw_values jsonb not null,             -- a linha exatamente como lida da planilha, sem normalização
  row_hash text not null,                -- sha256(raw_values) — detecta a mesma linha reenviada em outro lote
  created_at timestamptz not null default now(),
  constraint import_source_records_unique unique (batch_id, source_file, source_sheet, source_row)
);
create index import_source_records_batch on public.import_source_records(batch_id);
create index import_source_records_hash on public.import_source_records(row_hash);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  source_record_id uuid references public.import_source_records(id),
  target_entity text not null check (target_entity in ('candidatos','employers','talent_mapping_profiles','talent_mapping_items','talent_mapping_partners')),
  target_key text not null,              -- chave natural/determinística usada para casar com um registro já existente
  existing_target_id text,               -- preenchido na validação, se um registro correspondente já existir
  normalized_payload jsonb not null,     -- valor pronto para gravação (após normalização, não a fórmula/texto bruto)
  previous_value_snapshot jsonb,         -- estado anterior do registro alvo, quando é uma atualização (permite 06 reverter só os campos alterados)
  validation_status text not null default 'pending' check (validation_status in ('pending','valid','rejected','duplicate','needs_review')),
  rejection_reason text,
  created_at timestamptz not null default now()
);
create index import_rows_batch on public.import_rows(batch_id);
create index import_rows_target on public.import_rows(target_entity, target_key);
create index import_rows_status on public.import_rows(batch_id, validation_status);

create table public.import_errors (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  import_row_id uuid references public.import_rows(id),
  severity text not null check (severity in ('warning','error','blocker')),
  message text not null,
  created_at timestamptz not null default now()
);
create index import_errors_batch on public.import_errors(batch_id);

alter table public.import_batches enable row level security;
alter table public.import_source_records enable row level security;
alter table public.import_rows enable row level security;
alter table public.import_errors enable row level security;
revoke all on public.import_batches, public.import_source_records, public.import_rows, public.import_errors from public, anon;
grant select, insert, update on public.import_batches, public.import_source_records, public.import_rows, public.import_errors to authenticated;
grant all on public.import_batches, public.import_source_records, public.import_rows, public.import_errors to service_role;

create policy import_batches_rw on public.import_batches for all to authenticated
  using (public.t4_talents_v22_access(false)) with check (public.t4_talents_v22_access(true));
create policy import_source_records_rw on public.import_source_records for all to authenticated
  using (public.t4_talents_v22_access(false)) with check (public.t4_talents_v22_access(true));
create policy import_rows_rw on public.import_rows for all to authenticated
  using (public.t4_talents_v22_access(false)) with check (public.t4_talents_v22_access(true));
create policy import_errors_rw on public.import_errors for all to authenticated
  using (public.t4_talents_v22_access(false)) with check (public.t4_talents_v22_access(true));

do $verify$
declare target text;
begin
  foreach target in array array['import_batches','import_source_records','import_rows','import_errors'] loop
    if has_table_privilege('anon', 'public.'||target, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or not (select relrowsecurity from pg_class where oid = to_regclass('public.'||target)) then
      raise exception 'Verificação de segurança reprovada em %', target;
    end if;
  end loop;
end;
$verify$;
notify pgrst, 'reload schema';
commit;
