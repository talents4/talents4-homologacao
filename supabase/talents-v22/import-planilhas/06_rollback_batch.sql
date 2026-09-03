-- Talents 4 · importação controlada — reversão de um lote específico.
-- APLICAÇÃO MANUAL. Atua SOMENTE sobre o lote informado, nunca em dados que
-- não pertencem a ele:
--   - Registros CRIADOS por este lote (import_rows.existing_target_id nulo,
--     ou seja, não existiam antes) são apagados por completo.
--   - Registros ATUALIZADOS por este lote (existing_target_id preenchido —
--     já existiam antes da importação) NUNCA são apagados; só os campos
--     que o lote alterou são restaurados a partir de
--     import_rows.previous_value_snapshot. O registro em si, e qualquer
--     campo que o lote não tocou, permanece intacto.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function public.t4_rollback_import_batch(p_batch_id uuid, p_confirm boolean)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public
as $fn$
declare
  batch record; r record;
  deleted_counts jsonb := '{}'::jsonb; restored_counts jsonb := '{}'::jsonb;
  set_clause text; target_id text;
begin
  if not public.t4_talents_v22_access(true) then raise exception 'Sem permissão para reverter uma importação'; end if;
  if p_confirm is distinct from true then raise exception 'Confirmação explícita exigida (p_confirm = true). Nada foi revertido.'; end if;

  select * into batch from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'Lote inexistente: %', p_batch_id; end if;
  if batch.status not in ('applied','partially_applied') then
    raise exception 'Lote % está no estado "%"; só lotes aplicados podem ser revertidos.', p_batch_id, batch.status;
  end if;

  -- Restaura registros que já existiam antes do lote (update), campo a campo.
  -- O tipo de cada coluna é lido de information_schema (udt_name: o nome
  -- curto usável como alvo de cast, ex. "numeric"/"bool"/"timestamptz" — já
  -- data_type devolveria "timestamp with time zone", que quebraria o
  -- "::%s" abaixo). Sem isso, todo campo seria restaurado como texto e a
  -- reversão falharia (com segurança, a transação inteira desfaz — mas não
  -- reverteria de fato) em qualquer coluna não-texto tocada pelo lote, como
  -- professional_score (numeric) ou employers.ativo (boolean).
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

  -- Apaga só o que este lote criou do zero (nunca o que já existia antes dele).
  execute 'delete from public.talent_mapping_items where import_batch_id = $1' using p_batch_id;
  execute 'delete from public.talent_mapping_partners where import_batch_id = $1' using p_batch_id;
  execute 'delete from public.talent_mapping_profiles where import_batch_id = $1' using p_batch_id;
  for r in select target_entity, count(*) as n from (
    select 'candidatos' as target_entity, id from public.candidatos where import_batch_id = p_batch_id
    union all select 'employers', id from public.employers where import_batch_id = p_batch_id
  ) x group by target_entity loop
    deleted_counts := jsonb_set(deleted_counts, array[r.target_entity], to_jsonb(r.n));
  end loop;
  delete from public.candidatos where import_batch_id = p_batch_id;
  delete from public.employers where import_batch_id = p_batch_id;

  update public.import_batches set status = 'rolled_back', rolled_back_at = now(), rolled_back_by = auth.uid() where id = p_batch_id;

  return jsonb_build_object('batch_id', p_batch_id, 'deleted', deleted_counts, 'restored', restored_counts);
end;
$fn$;
revoke all on function public.t4_rollback_import_batch(uuid, boolean) from public, anon;
grant execute on function public.t4_rollback_import_batch(uuid, boolean) to authenticated, service_role;

commit;

-- Depois de rodar, confirme com 05_verify_import.sql que a contagem real
-- para este batch_id caiu a zero (exceto os campos restaurados, que
-- pertencem a registros anteriores ao lote e continuam existindo).
