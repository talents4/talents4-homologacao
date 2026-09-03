-- Talents 4 · importação controlada — corrige perda de dados na reversão de lote.
-- PROPOSTA, NÃO APLICADA. Requer revisão e aplicação manual no SQL Editor,
-- na mesma ordem/disciplina dos scripts anteriores (preflight embutido,
-- transação própria, verify embutido).
--
-- Achado de auditoria (2026-09-03, sessão de conexão do frontend ao staging):
-- t4_stage_import_row() (03_load_staging.sql, já aplicada) nunca recebe
-- existing_target_id nem previous_value_snapshot como parâmetro — as duas
-- colunas de import_rows criadas exatamente para isso (02_create_staging.sql,
-- linhas 60 e 62) ficam sempre NULL. t4_rollback_import_batch()
-- (06_rollback_batch.sql, já aplicada) apaga hoje TODO registro marcado
-- com import_batch_id = <lote> nas 5 tabelas alvo, sem checar se aquele
-- registro foi criado pelo lote ou só atualizado por ele — porque
-- t4_apply_import_batch() marca import_batch_id tanto em INSERT quanto em
-- UPDATE (04_apply_import.sql, "on conflict (id) do update set ...,
-- import_batch_id = $2"; essa coluna significa "último lote que tocou o
-- registro", nunca "lote que criou o registro").
--
-- Consequência real, ainda não manifestada em produção porque nenhum
-- frontend chamou essas funções até agora: reverter um lote que tenha
-- ATUALIZADO um Talento ou Empregador pré-existente apagaria esse registro
-- por completo, em vez de só restaurar os campos que o lote alterou — o
-- oposto exato do que o comentário original da função promete ("nunca apaga
-- o que já existia antes dele") e da regra de produto "não apague
-- históricos/registros de empresas que ainda possuam relacionamentos".
--
-- Esta correção: (1) recria t4_stage_import_row com dois parâmetros novos,
-- opcionais, no final (compatível com qualquer chamador que já use a
-- assinatura antiga — não há nenhum ainda, mas o padrão é o mesmo dos
-- scripts anteriores: aditivo, não destrutivo); (2) corrige
-- t4_rollback_import_batch para apagar, em cada uma das 5 tabelas alvo,
-- somente os registros cujo import_rows.existing_target_id é nulo (ou
-- seja, criados pelo próprio lote) — nunca mais um registro que já existia
-- antes dele. Como efeito colateral correto: se um registro criado por este
-- lote foi depois tocado por um lote MAIS RECENTE, o filtro
-- "import_batch_id = <este lote>" na exclusão também impede apagá-lo (o
-- import_batch_id já não aponta mais para este lote).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preconditions$
begin
  if to_regprocedure('public.t4_stage_import_row(uuid, text, text, integer, jsonb, text, text, text, jsonb, text, text)') is null then
    raise exception 'Assinatura antiga (11 parâmetros) de t4_stage_import_row não encontrada. Este script corrige exatamente a versão aplicada por 03_load_staging.sql; se a função já foi alterada por outro caminho, revise manualmente antes de continuar.';
  end if;
  if to_regprocedure('public.t4_rollback_import_batch(uuid, boolean)') is null then
    raise exception 'Função t4_rollback_import_batch ausente. Aplique 02_create_staging.sql, 03_load_staging.sql e 06_rollback_batch.sql primeiro.';
  end if;
  if exists (select 1 from public.import_rows where existing_target_id is not null) then
    raise exception 'Já existem linhas em import_rows com existing_target_id preenchido — isso não deveria acontecer com a função atual. Pare e investigue antes de continuar; esta migração assume que o bug ainda não foi contornado de outra forma.';
  end if;
end;
$preconditions$;

drop function public.t4_stage_import_row(uuid, text, text, integer, jsonb, text, text, text, jsonb, text, text);

create function public.t4_stage_import_row(
  p_batch_id uuid, p_source_file text, p_source_sheet text, p_source_row integer,
  p_raw_values jsonb, p_row_hash text,
  p_target_entity text, p_target_key text, p_normalized_payload jsonb,
  p_validation_status text, p_rejection_reason text default null,
  p_existing_target_id text default null, p_previous_value_snapshot jsonb default null
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

  insert into public.import_rows (batch_id, source_record_id, target_entity, target_key, normalized_payload, validation_status, rejection_reason, existing_target_id, previous_value_snapshot)
    values (p_batch_id, source_id, p_target_entity, p_target_key, p_normalized_payload, p_validation_status, p_rejection_reason, p_existing_target_id, p_previous_value_snapshot)
    returning id into row_id;
  return row_id;
end;
$fn$;
revoke all on function public.t4_stage_import_row(uuid, text, text, integer, jsonb, text, text, text, jsonb, text, text, text, jsonb) from public, anon;
grant execute on function public.t4_stage_import_row(uuid, text, text, integer, jsonb, text, text, text, jsonb, text, text, text, jsonb) to authenticated, service_role;

create or replace function public.t4_rollback_import_batch(p_batch_id uuid, p_confirm boolean)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public
as $fn$
declare
  batch record; r record;
  deleted_counts jsonb := '{}'::jsonb; restored_counts jsonb := '{}'::jsonb;
  set_clause text; entity text; n integer;
begin
  if not public.t4_talents_v22_access(true) then raise exception 'Sem permissão para reverter uma importação'; end if;
  if p_confirm is distinct from true then raise exception 'Confirmação explícita exigida (p_confirm = true). Nada foi revertido.'; end if;

  select * into batch from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'Lote inexistente: %', p_batch_id; end if;
  if batch.status not in ('applied','partially_applied') then
    raise exception 'Lote % está no estado "%"; só lotes aplicados podem ser revertidos.', p_batch_id, batch.status;
  end if;

  -- Restaura registros que já existiam antes do lote (update), campo a campo.
  for r in select * from public.import_rows where batch_id = p_batch_id and validation_status = 'valid' and existing_target_id is not null and previous_value_snapshot is not null loop
    set_clause := (
      select string_agg(
        format('%I = ($1->>%L)::%s', key, key,
          coalesce((select c.udt_name from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = r.target_entity and c.column_name = key),
                   'text')),
        ', ')
      from jsonb_object_keys(r.previous_value_snapshot) as key
    );
    if set_clause is not null then
      execute format('update public.%I set %s where id = $2', r.target_entity, set_clause) using r.previous_value_snapshot, r.existing_target_id;
      restored_counts := jsonb_set(restored_counts, array[r.target_entity], to_jsonb(coalesce((restored_counts->>r.target_entity)::integer, 0) + 1));
    end if;
  end loop;

  -- Apaga só o que este lote de fato CRIOU (import_rows.existing_target_id
  -- nulo), nunca um registro que já existia antes dele — mesmo que
  -- candidatos/employers/talent_mapping_*.import_batch_id aponte para este
  -- lote (essa coluna é "último lote que tocou o registro", não "lote que
  -- criou o registro"; só import_rows.existing_target_id sabe a diferença).
  -- Efeito colateral correto: se este lote criou um registro e um lote MAIS
  -- RECENTE depois o atualizou, o filtro "import_batch_id = este lote" abaixo
  -- também impede apagá-lo (import_batch_id já mudou para o lote mais novo).
  foreach entity in array array['candidatos','employers','talent_mapping_profiles','talent_mapping_items','talent_mapping_partners'] loop
    execute format(
      'with created_ids as (
         select normalized_payload->>''id'' as target_id
         from public.import_rows
         where batch_id = $1 and target_entity = $2 and validation_status = ''valid'' and existing_target_id is null
       ), deleted as (
         delete from public.%I t using created_ids c
         where t.id::text = c.target_id and t.import_batch_id = $1
         returning t.id
       ) select count(*) from deleted', entity
    ) using p_batch_id, entity into n;
    if n > 0 then deleted_counts := jsonb_set(deleted_counts, array[entity], to_jsonb(n)); end if;
  end loop;

  update public.import_batches set status = 'rolled_back', rolled_back_at = now(), rolled_back_by = auth.uid() where id = p_batch_id;

  return jsonb_build_object('batch_id', p_batch_id, 'deleted', deleted_counts, 'restored', restored_counts);
end;
$fn$;
revoke all on function public.t4_rollback_import_batch(uuid, boolean) from public, anon;
grant execute on function public.t4_rollback_import_batch(uuid, boolean) to authenticated, service_role;

do $verify$
begin
  if to_regprocedure('public.t4_stage_import_row(uuid, text, text, integer, jsonb, text, text, text, jsonb, text, text, text, jsonb)') is null then
    raise exception 'Verificação falhou: assinatura nova de t4_stage_import_row não encontrada após a migração.';
  end if;
  if to_regprocedure('public.t4_stage_import_row(uuid, text, text, integer, jsonb, text, text, text, jsonb, text, text)') is not null then
    raise exception 'Verificação falhou: a assinatura antiga (11 parâmetros) de t4_stage_import_row ainda existe; deveria ter sido substituída.';
  end if;
  if has_function_privilege('anon', 'public.t4_stage_import_row(uuid, text, text, integer, jsonb, text, text, text, jsonb, text, text, text, jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.t4_rollback_import_batch(uuid, boolean)', 'EXECUTE') then
    raise exception 'Verificação falhou: anon não pode ter permissão de execução nestas funções.';
  end if;
end;
$verify$;
notify pgrst, 'reload schema';
commit;

-- Depois de aplicar: reconfirme com uma sondagem de leitura (mesma técnica
-- das auditorias anteriores) que a assinatura de 13 parâmetros responde e a
-- de 11 não existe mais, antes de o frontend passar a chamar esta função.
