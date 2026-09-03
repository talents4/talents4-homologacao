-- Talents 4 · importação controlada das planilhas oficiais — pré-checagem.
-- SOMENTE LEITURA. Não cria, altera ou remove nada. Não lê linha de negócio
-- nenhuma (nomes, e-mails, telefones, currículos) — só catálogo do Postgres.
-- Execute isto ANTES de 01_schema_additive.sql, em uma consulta nova do
-- SQL Editor do projeto de homologação correto.
with required_tables(table_name) as (
  values ('candidatos'), ('employers'), ('employer_openings'),
    ('talent_mapping_profiles'), ('talent_mapping_items'), ('talent_mapping_partners')
), staging_tables(table_name) as (
  values ('import_batches'), ('import_source_records'), ('import_rows'), ('import_errors')
), classification_columns(column_name) as (
  values ('presented_by_nectanet'), ('source_channel'), ('direct_talents4_partnership'),
    ('partnership_status'), ('company_scope'), ('classification_confidence'),
    ('classification_source'), ('classification_notes'), ('import_batch_id')
), report as (
  select '01_TABELA_ALVO' as secao, r.table_name as item,
    case when to_regclass('public.'||r.table_name) is null then 'BLOQUEIO_AUSENTE' else 'OK' end as resultado,
    jsonb_build_object('nota', 'Tabela precisa existir antes de propor colunas aditivas nela') as detalhes
  from required_tables r
  union all
  select '02_TABELA_STAGING_JA_EXISTE', s.table_name,
    case when to_regclass('public.'||s.table_name) is null then 'NOVA_PREVISTA' else 'BLOQUEIO_JA_EXISTE' end,
    jsonb_build_object('acao', 'Se já existe, não reaplicar 02_create_staging.sql por tentativa; revisar estrutura primeiro')
  from staging_tables s
  union all
  select '03_COLUNA_CLASSIFICACAO_JA_EXISTE', 'employers.'||c.column_name,
    case when col.column_name is null then 'NOVA_PREVISTA' else 'BLOQUEIO_JA_EXISTE' end,
    jsonb_build_object('tipo', col.data_type)
  from classification_columns c
  left join information_schema.columns col
    on col.table_schema = 'public' and col.table_name = 'employers' and col.column_name = c.column_name
  union all
  select '04_COLUNA_LOTE_JA_EXISTE', t.table_name||'.import_batch_id',
    case when col.column_name is null then 'NOVA_PREVISTA' else 'BLOQUEIO_JA_EXISTE' end,
    jsonb_build_object('tipo', col.data_type)
  from required_tables t
  left join information_schema.columns col
    on col.table_schema = 'public' and col.table_name = t.table_name and col.column_name = 'import_batch_id'
  where t.table_name in ('candidatos','employers','talent_mapping_profiles','talent_mapping_items','talent_mapping_partners')
  union all
  select '05_AMBIENTE', 'PostgreSQL', 'INFORMACAO',
    jsonb_build_object('versao', current_setting('server_version'), 'banco', current_database(), 'usuario_execucao', current_user)
)
select * from report order by secao, item;
