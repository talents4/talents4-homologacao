-- Talents 4 · importação controlada — colunas aditivas nas tabelas alvo.
-- APLICAÇÃO MANUAL, SOMENTE APÓS revisar 00_preflight.sql sem BLOQUEIO_*.
-- Não regrava registros existentes, não altera RLS/policies já existentes
-- nas tabelas alvo, não cria tabela nova (isso é 02_create_staging.sql).
-- Recusa reaplicação por tentativa (idempotente via IF NOT EXISTS + checagem
-- de precondição, no mesmo padrão de supabase/talents-v22/10_additive.sql).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preconditions$
declare target text;
begin
  foreach target in array array['candidatos','employers','talent_mapping_profiles','talent_mapping_items','talent_mapping_partners'] loop
    if to_regclass('public.'||target) is null then
      raise exception 'Tabela alvo ausente: %. Rode 00_preflight.sql primeiro.', target;
    end if;
  end loop;
end;
$preconditions$;

-- Classificação de empresa (ver docs/mapeamento/CLASSIFICACAO_EMPRESAS.md).
-- direct_talents4_partnership e partnership_status ficam sempre 'UNKNOWN'
-- até revisão humana explícita — nenhuma planilha tem essa informação de
-- forma confiável, e o código de importação nunca grava outro valor sozinho.
alter table public.employers
  add column if not exists presented_by_nectanet boolean,
  add column if not exists source_channel text check (source_channel is null or source_channel in ('NECTANET','TALENTS4_DIRECT','OTHER','UNKNOWN')),
  add column if not exists direct_talents4_partnership text check (direct_talents4_partnership is null or direct_talents4_partnership in ('UNKNOWN','CONFIRMADA','REJEITADA')),
  add column if not exists partnership_status text check (partnership_status is null or partnership_status in ('ACTIVE','PROSPECT','FORMER','PAUSED','UNKNOWN')),
  add column if not exists company_scope text check (company_scope is null or company_scope in ('GENERAL','NECTANET_PRESENTED','TALENTS4_PARTNER','EXTERNAL_BW','UNKNOWN')),
  add column if not exists classification_confidence text check (classification_confidence is null or classification_confidence in ('HIGH','MEDIUM','LOW')),
  add column if not exists classification_source text,
  add column if not exists classification_notes text;

-- Rastreio de lote: permite que 06_rollback_batch.sql reverta com precisão
-- só o que um lote específico criou, sem tocar em nada anterior a ele.
-- Nullable porque registros que já existiam antes desta migração não têm
-- lote de origem — isso é esperado e correto, não um erro a corrigir.
alter table public.candidatos add column if not exists import_batch_id uuid;
alter table public.employers add column if not exists import_batch_id uuid;
alter table public.talent_mapping_profiles add column if not exists import_batch_id uuid;
alter table public.talent_mapping_items add column if not exists import_batch_id uuid;
alter table public.talent_mapping_partners add column if not exists import_batch_id uuid;

do $verify$
declare missing text[];
begin
  select array_agg(c.column_name) into missing
  from (values ('presented_by_nectanet'),('source_channel'),('direct_talents4_partnership'),('partnership_status'),('company_scope'),('classification_confidence'),('classification_source'),('classification_notes')) c(column_name)
  left join information_schema.columns col on col.table_schema='public' and col.table_name='employers' and col.column_name=c.column_name
  where col.column_name is null;
  if missing is not null then raise exception 'Colunas de classificação não foram criadas: %', missing; end if;
end;
$verify$;
notify pgrst, 'reload schema';
commit;
