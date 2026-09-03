-- Talents 4 · importação controlada — verificação pós-aplicação.
-- SOMENTE LEITURA. Compara previsto × real × o que de fato está gravado nas
-- tabelas alvo agora, para o lote informado. Rode depois de
-- 04_apply_import.sql, numa consulta separada.
with batch as (
  select * from public.import_batches where id = :'batch_id'::uuid
), by_entity as (
  select target_entity, validation_status, count(*) as n
  from public.import_rows where batch_id = :'batch_id'::uuid
  group by target_entity, validation_status
), live_counts as (
  select 'candidatos' as target_entity, count(*) as live_n from public.candidatos where import_batch_id = :'batch_id'::uuid
  union all select 'employers', count(*) from public.employers where import_batch_id = :'batch_id'::uuid
  union all select 'talent_mapping_profiles', count(*) from public.talent_mapping_profiles where import_batch_id = :'batch_id'::uuid
  union all select 'talent_mapping_items', count(*) from public.talent_mapping_items where import_batch_id = :'batch_id'::uuid
  union all select 'talent_mapping_partners', count(*) from public.talent_mapping_partners where import_batch_id = :'batch_id'::uuid
)
select
  b.id as batch_id, b.status, b.created_at, b.applied_at,
  b.expected_counts, b.actual_counts,
  jsonb_object_agg(coalesce(e.target_entity, l.target_entity), jsonb_build_object('staged', e.n, 'validation_status', e.validation_status, 'linhas_de_fato_marcadas_com_este_lote', l.live_n)) as detalhe_por_entidade,
  (select count(*) from public.import_errors where batch_id = :'batch_id'::uuid) as total_erros
from batch b
left join by_entity e on true
left join live_counts l on l.target_entity = e.target_entity
group by b.id, b.status, b.created_at, b.applied_at, b.expected_counts, b.actual_counts;

-- Erros e rejeições linha a linha, para inspeção detalhada:
select target_entity, target_key, validation_status, rejection_reason, created_at
from public.import_rows
where batch_id = :'batch_id'::uuid and validation_status in ('rejected','needs_review')
order by target_entity, created_at;
