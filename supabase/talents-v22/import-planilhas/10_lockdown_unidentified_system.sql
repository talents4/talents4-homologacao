-- Talents 4 · Bloqueio imediato do sistema não identificado (org_*/drive_*)
--
-- Investigação em andamento (07_auditoria_tabelas_desconhecidas.sql e
-- 08_investigacao_origem_sistemas_paralelos.sql): 11 tabelas com gatilhos
-- ativos, gravadas uma única vez em abril de 2026 por um processo externo
-- usando a service role key, nunca mais tocadas desde então — origem ainda
-- não confirmada.
--
-- A auditoria de grants (rodada em 06/09/2026) encontrou o papel "anon"
-- (qualquer visitante do site, SEM login) com DELETE, INSERT, REFERENCES,
-- SELECT, TRIGGER, TRUNCATE e UPDATE em 7 destas tabelas, e "authenticated"
-- (qualquer pessoa logada, mesmo com papel "viewer") com o mesmo conjunto
-- amplo de privilégios nas 11. Isto não depende de nenhuma policy de RLS
-- estar certa ou errada para ser um problema: nenhum papel que não seja
-- administrador do banco deveria ter esse nível de acesso a tabelas que
-- nenhuma tela deste sistema usa. TRUNCATE em especial nem respeita RLS.
--
-- Este script SÓ revoga privilégios de anon e authenticated. Não apaga
-- tabelas, não apaga nenhuma linha, não altera policies de RLS existentes,
-- não afeta service_role nem postgres (que a investigação continua
-- usando). Nenhuma tela deste repositório referencia estas 11 tabelas —
-- confirmado nas duas investigações acima — então não há risco de quebrar
-- nada em uso.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preconditions$
declare target text;
begin
  foreach target in array array[
    'drive_connections','drive_import_drafts','drive_nodes',
    'org_activities','org_documents','org_employer_profiles','org_matches',
    'org_meetings','org_notes','org_openings','org_pipeline_items'
  ]
  loop
    if to_regclass('public.'||target) is null then
      raise exception 'Tabela esperada ausente: %. Confirme que a investigação (07/08) ainda descreve o mesmo conjunto de tabelas antes de aplicar este bloqueio.', target;
    end if;
    if not (select relrowsecurity from pg_class where oid = to_regclass('public.'||target)) then
      raise exception 'RLS não está ativo em % — não prossiga sem confirmar o schema primeiro.', target;
    end if;
  end loop;
end;
$preconditions$;

revoke all on
  public.drive_connections, public.drive_import_drafts, public.drive_nodes,
  public.org_activities, public.org_documents, public.org_employer_profiles, public.org_matches,
  public.org_meetings, public.org_notes, public.org_openings, public.org_pipeline_items
from anon, authenticated;

do $verify$
declare target text;
begin
  foreach target in array array[
    'drive_connections','drive_import_drafts','drive_nodes',
    'org_activities','org_documents','org_employer_profiles','org_matches',
    'org_meetings','org_notes','org_openings','org_pipeline_items'
  ]
  loop
    if has_table_privilege('anon', 'public.'||target, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_table_privilege('authenticated', 'public.'||target, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception 'Revogação falhou para %: anon ou authenticated ainda têm algum privilégio.', target;
    end if;
  end loop;
end;
$verify$;

commit;

-- Verificação manual recomendada logo após aplicar, no mesmo SQL Editor:
--
-- select table_name, grantee, string_agg(privilege_type, ', ') as privilegios
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in ('drive_connections','drive_import_drafts','drive_nodes',
--     'org_activities','org_documents','org_employer_profiles','org_matches',
--     'org_meetings','org_notes','org_openings','org_pipeline_items')
--   and grantee in ('anon','authenticated')
-- group by 1, 2;
--
-- Deve retornar ZERO linhas. Se aparecer alguma, a revogação não pegou
-- para aquela combinação de tabela/papel — pare e investigue antes de
-- considerar concluído.
--
-- Depois, use o site normalmente (login, navegue pelas telas de Talentos,
-- Organizacional, Contatos, Alemão) para confirmar que nada quebrou —
-- nenhuma tela usa estas 11 tabelas, então nada deveria mudar visualmente.
--
-- Isto NÃO fecha a investigação: as tabelas continuam existindo, com os
-- dados de abril intactos, esperando a decisão final (manter protegidas,
-- documentar e arquivar, ou apagar) depois de identificar a origem.
