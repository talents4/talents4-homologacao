-- Talents 4 · investigação de origem — sistemas org_*/drive_* não reconhecidos
-- por ninguém (nem você, nem eu). SOMENTE LEITURA e SOMENTE METADADOS: nenhuma
-- coluna de conteúdo de negócio é lida em nenhuma consulta abaixo — só
-- datas/contagens (para saber QUANDO isto foi usado, não O QUE contém) e
-- definição de schema/função (código, não dado).
-- Execute cada bloco por vez no SQL Editor; são independentes entre si.

-- ============================================================
-- 1) Quando essas tabelas foram usadas pela última vez? (só datas, 0 conteúdo)
-- ============================================================
select 'org_matches' as tabela, min(created_at) as primeiro_registro, max(created_at) as ultimo_criado, max(updated_at) as ultima_atualizacao, count(*) as total
from public.org_matches
union all
select 'org_employer_profiles', min(created_at), max(created_at), max(updated_at), count(*)
from public.org_employer_profiles
union all
select 'drive_import_drafts', min(created_at), max(created_at), max(updated_at), count(*)
from public.drive_import_drafts;

-- ============================================================
-- 2) As outras 6 tabelas org_* + drive_nodes/drive_connections que só
--    apareceram via FK na investigação anterior — ainda não inspecionadas
--    diretamente. Só contagem de linhas, nada de conteúdo.
-- Consultadas direto (sem guarda condicional): a investigação anterior já
-- provou que as 8 existem em public — cada uma aparece como tabela
-- referenciada por uma FK real pertencente a public.org_matches ou
-- public.drive_import_drafts, e o Postgres não deixa uma constraint dessas
-- existir apontando para uma tabela ausente. Uma guarda com
-- "case when existe then (select count(*) from X) end" pareceria mais
-- segura, mas não é — o Postgres resolve o nome da tabela ao analisar a
-- consulta, antes de decidir qual ramo do CASE roda, então falharia do
-- mesmo jeito se X não existisse (mesmo problema já corrigido no script 07).
-- ============================================================
select 'org_openings' as tabela, count(*) as linhas from public.org_openings
union all select 'org_meetings', count(*) from public.org_meetings
union all select 'org_notes', count(*) from public.org_notes
union all select 'org_documents', count(*) from public.org_documents
union all select 'org_activities', count(*) from public.org_activities
union all select 'org_pipeline_items', count(*) from public.org_pipeline_items
union all select 'drive_nodes', count(*) from public.drive_nodes
union all select 'drive_connections', count(*) from public.drive_connections;

-- ============================================================
-- 3) drive_connections: nomes de coluna só (sem ler nenhum valor) — pode
--    revelar se guarda um e-mail/conta Google, um folder_id, um token, etc.
--    só pelos NOMES das colunas, nunca pelo conteúdo.
-- ============================================================
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name in ('drive_connections', 'drive_nodes')
order by table_name, ordinal_position;

-- ============================================================
-- 4) O código-fonte das funções envolvidas — é definição de schema, não
--    dado de negócio. Pode revelar se alguma delas chama uma extensão de
--    rede (pg_net/http) ou referencia algo fora deste banco.
-- ============================================================
select p.proname as funcao, pg_get_functiondef(p.oid) as definicao
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('validate_drive_import_source', 'touch_drive_updated_at', 'org_set_updated_at', 'is_admin', 'current_app_role', 'can_edit_crm')
order by p.proname;

-- ============================================================
-- 5) Extensões instaladas — pg_net/http/pg_cron indicariam que o próprio
--    Postgres consegue chamar serviços externos ou rodar tarefas
--    agendadas (explicaria como um pipeline de Drive escreveria sozinho).
-- ============================================================
select extname, extversion from pg_extension order by extname;

-- ============================================================
-- 6) Se pg_cron estiver instalado (só roda se existir; ignore o erro
--    "relation does not exist" se não existir — significa que não há
--    tarefa agendada pelo pg_cron neste banco):
-- ============================================================
-- select jobid, schedule, command, nodename, database, jobname, active
-- from cron.job order by jobid;

-- ============================================================
-- 7) supabase_vault está instalado (achado do bloco 5, 2026-09-03) — é a
--    extensão de segredo criptografado do Supabase. Só o NOME/descrição de
--    cada segredo guardado, nunca o valor decifrado (isto lê vault.secrets,
--    não vault.decrypted_secrets — não peço para decifrar nada). Um nome
--    como "google_drive_service_account" ou "drive_import_token" seria uma
--    evidência forte de qual sistema usa isso; nomes genéricos não provam
--    nada sozinhos.
-- ============================================================
select id, name, description, created_at, updated_at from vault.secrets order by created_at;
