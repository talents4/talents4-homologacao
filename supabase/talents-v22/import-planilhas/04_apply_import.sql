-- Talents 4 · importação controlada — aplicação do lote (staging → tabelas reais).
-- APLICAÇÃO MANUAL, SOMENTE APÓS 03_load_staging.sql e SOMENTE com um lote
-- já revisado na prévia do Centro de dados. Esta é a ÚNICA função desta
-- série que grava nas tabelas de negócio (candidatos, employers,
-- talent_mapping_*), e só faz isso dentro de uma transação: se qualquer
-- verificação de segurança falhar, nada é gravado.
--
-- Protege explicitamente contra o incidente de mais de 200 registros
-- criados indevidamente: exige a contagem prevista como parâmetro e aborta
-- (sem gravar nada) se a contagem real de linhas válidas no lote não bater
-- exatamente, ou se ultrapassar o safety_limit do lote.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preconditions$
begin
  if to_regclass('public.import_rows') is null then raise exception 'Tabelas de staging ausentes. Aplique 02_create_staging.sql e 03_load_staging.sql primeiro.'; end if;
end;
$preconditions$;

create function public.t4_apply_import_batch(p_batch_id uuid, p_confirm boolean, p_expected_row_count integer)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public
as $fn$
declare
  batch record;
  real_count integer;
  applied_counts jsonb := '{}'::jsonb;
  rejected_count integer := 0;
  r record;
  target_id text;
  set_clause text;
  col text;
begin
  if not public.t4_talents_v22_access(true) then raise exception 'Sem permissão para aplicar uma importação'; end if;
  if p_confirm is distinct from true then
    raise exception 'Confirmação explícita exigida (p_confirm = true). Nada foi gravado.';
  end if;

  select * into batch from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'Lote inexistente: %', p_batch_id; end if;
  if batch.status not in ('staged','previewed') then
    raise exception 'Lote % já está no estado "%"; não pode ser aplicado de novo. Use um lote novo.', p_batch_id, batch.status;
  end if;

  select count(*) into real_count from public.import_rows where batch_id = p_batch_id and validation_status = 'valid';

  if real_count is distinct from p_expected_row_count then
    update public.import_batches set status = 'aborted' where id = p_batch_id;
    insert into public.import_errors (batch_id, severity, message)
      values (p_batch_id, 'blocker', format('Abortado: contagem real de linhas válidas (%s) difere da prevista (%s). Nada foi gravado.', real_count, p_expected_row_count));
    raise exception 'Contagem real (%) difere da prevista (%). Lote abortado, nada foi gravado. Revise a prévia antes de tentar de novo.', real_count, p_expected_row_count;
  end if;

  if real_count > batch.safety_limit then
    update public.import_batches set status = 'aborted' where id = p_batch_id;
    insert into public.import_errors (batch_id, severity, message)
      values (p_batch_id, 'blocker', format('Abortado: %s linhas válidas excede o limite de segurança do lote (%s). Nada foi gravado.', real_count, batch.safety_limit));
    raise exception 'Limite de segurança excedido (% > %). Lote abortado, nada foi gravado. Isto existe para nunca repetir o incidente de importação em massa.', real_count, batch.safety_limit;
  end if;

  -- Cada linha válida é aplicada individualmente, em savepoint próprio: uma
  -- falha isolada (ex.: violação de constraint numa linha) é registrada em
  -- import_errors e a linha marcada como rejeitada, sem abortar o lote
  -- inteiro nem perder o que já foi aplicado com sucesso.
  for r in select * from public.import_rows where batch_id = p_batch_id and validation_status = 'valid' order by created_at loop
    begin
      target_id := coalesce(r.existing_target_id, r.normalized_payload->>'id');
      if target_id is null then
        raise exception 'normalized_payload sem "id" e existing_target_id ausente';
      end if;
      set_clause := (
        select string_agg(format('%I = excluded.%I', key, key), ', ')
        from jsonb_object_keys(r.normalized_payload) as key
        where key <> 'id'
      );
      execute format(
        'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) on conflict (id) do update set %s, import_batch_id = $2',
        r.target_entity, r.target_entity, coalesce(set_clause, 'import_batch_id = $2')
      ) using (r.normalized_payload || jsonb_build_object('import_batch_id', p_batch_id)), p_batch_id;

      update public.import_rows set validation_status = 'valid' where id = r.id; -- mantém 'valid'; aplicado com sucesso
      applied_counts := jsonb_set(applied_counts, array[r.target_entity], to_jsonb(coalesce((applied_counts->>r.target_entity)::integer, 0) + 1));
    exception when others then
      rejected_count := rejected_count + 1;
      update public.import_rows set validation_status = 'rejected', rejection_reason = sqlerrm where id = r.id;
      insert into public.import_errors (batch_id, import_row_id, severity, message) values (p_batch_id, r.id, 'error', sqlerrm);
    end;
  end loop;

  update public.import_batches
    set status = case when rejected_count = 0 then 'applied' else 'partially_applied' end,
        actual_counts = applied_counts, applied_at = now(), applied_by = auth.uid()
    where id = p_batch_id;

  return jsonb_build_object('batch_id', p_batch_id, 'applied', applied_counts, 'rejected', rejected_count, 'expected', p_expected_row_count, 'real', real_count);
end;
$fn$;
revoke all on function public.t4_apply_import_batch(uuid, boolean, integer) from public, anon;
grant execute on function public.t4_apply_import_batch(uuid, boolean, integer) to authenticated, service_role;

commit;
