-- Talents 4 · importação controlada — funções para carregar o staging.
-- APLICAÇÃO MANUAL, SOMENTE APÓS 02_create_staging.sql.
-- Cria 2 funções que o frontend chama via RPC durante a prévia da
-- importação (Centro de dados). Nenhuma delas grava em candidatos/
-- employers/talent_mapping_* — só nas 4 tabelas de staging. O hash da
-- linha é calculado no navegador (Web Crypto, SHA-256) e passado como
-- parâmetro, para não depender de uma extensão de criptografia no banco.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preconditions$
begin
  if to_regclass('public.import_batches') is null or to_regclass('public.import_rows') is null then
    raise exception 'Tabelas de staging ausentes. Aplique 02_create_staging.sql primeiro.';
  end if;
end;
$preconditions$;

create function public.t4_create_import_batch(source_files jsonb, expected_counts jsonb default null, safety_limit integer default 200)
returns uuid language plpgsql security invoker set search_path = pg_catalog, public
as $fn$
declare new_id uuid;
begin
  if not public.t4_talents_v22_access(true) then raise exception 'Sem permissão para iniciar uma importação'; end if;
  if jsonb_typeof(source_files) is distinct from 'array' or jsonb_array_length(source_files) = 0 then
    raise exception 'source_files precisa ser um array não vazio de {filename, sha256, size_bytes}';
  end if;
  insert into public.import_batches (source_files, expected_counts, safety_limit, created_by)
    values (source_files, expected_counts, coalesce(safety_limit, 200), auth.uid())
    returning id into new_id;
  return new_id;
end;
$fn$;
revoke all on function public.t4_create_import_batch(jsonb, jsonb, integer) from public, anon;
grant execute on function public.t4_create_import_batch(jsonb, jsonb, integer) to authenticated, service_role;

-- Idempotente por (batch_id, source_file, source_sheet, source_row): chamar
-- de novo para a mesma linha da mesma planilha no mesmo lote atualiza os
-- dados em vez de duplicar (protege contra o usuário reenviar o mesmo
-- arquivo sem perceber, ou um retry de rede no navegador).
-- p_validation_status: o app já faz toda a detecção de duplicidade, alias
-- de empresa e casamento de Talento no navegador durante a prévia (mesma
-- lógica de assets/t4-import-export.js); esta função só registra a decisão
-- já tomada, não a recalcula em SQL. Precisa ser 'valid', 'rejected' ou
-- 'needs_review' — nunca fica 'pending' silenciosamente.
create function public.t4_stage_import_row(
  p_batch_id uuid, p_source_file text, p_source_sheet text, p_source_row integer,
  p_raw_values jsonb, p_row_hash text,
  p_target_entity text, p_target_key text, p_normalized_payload jsonb,
  p_validation_status text, p_rejection_reason text default null
) returns uuid language plpgsql security invoker set search_path = pg_catalog, public
as $fn$
declare batch_status text; source_id uuid; row_id uuid;
begin
  if not public.t4_talents_v22_access(true) then raise exception 'Sem permissão para gravar no staging'; end if;
  select status into batch_status from public.import_batches where id = p_batch_id;
  if batch_status is null then raise exception 'Lote inexistente: %', p_batch_id; end if;
  if batch_status not in ('staged','previewed') then raise exception 'Lote % não aceita novas linhas no estado atual (%)', p_batch_id, batch_status; end if;
  if p_target_entity not in ('candidatos','employers','talent_mapping_profiles','talent_mapping_items','talent_mapping_partners') then
    raise exception 'target_entity inválido: %', p_target_entity;
  end if;
  if p_validation_status not in ('valid','rejected','needs_review') then
    raise exception 'validation_status deve ser decidido pelo chamador (valid/rejected/needs_review), não pending: %', p_validation_status;
  end if;

  insert into public.import_source_records (batch_id, source_file, source_sheet, source_row, raw_values, row_hash)
    values (p_batch_id, p_source_file, p_source_sheet, p_source_row, p_raw_values, p_row_hash)
    on conflict (batch_id, source_file, source_sheet, source_row) do update set raw_values = excluded.raw_values, row_hash = excluded.row_hash
    returning id into source_id;

  insert into public.import_rows (batch_id, source_record_id, target_entity, target_key, normalized_payload, validation_status, rejection_reason)
    values (p_batch_id, source_id, p_target_entity, p_target_key, p_normalized_payload, p_validation_status, p_rejection_reason)
    returning id into row_id;
  return row_id;
end;
$fn$;
revoke all on function public.t4_stage_import_row(uuid, text, text, integer, jsonb, text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.t4_stage_import_row(uuid, text, text, integer, jsonb, text, text, text, jsonb, text, text) to authenticated, service_role;

commit;
