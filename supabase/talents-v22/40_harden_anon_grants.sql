-- TALENTOS 2.2 · Endurecimento de privilégios do papel anon.
-- Não lê nem altera nenhuma linha de negócio. Apenas revoga SELECT do papel
-- anon nas tabelas que hoje têm o GRANT mas dependem inteiramente da RLS
-- para não expor linhas — confirmado por sondagem externa em 02/09/2026
-- (Content-Range: */0 em todas elas para o papel anon). Alinha essas tabelas
-- com o padrão mais estrito já usado em contact_records, crm_activities,
-- german_course_* e nas tabelas criadas por 10_additive.sql, que já revogam
-- anon por completo (defesa em profundidade: uma policy de RLS mal escrita
-- no futuro deixaria de ser a única barreira).
--
-- Não depende de, nem substitui, 10_additive.sql. Pode ser aplicado antes,
-- depois ou independentemente dele. Não afeta o papel authenticated — o
-- frontend continua funcionando normalmente após o login.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preconditions$
declare target text;
begin
  foreach target in array array['candidatos','employers','employer_openings','usuarios',
    'candidate_employer_matches','candidate_employer_links',
    'organizational_plan_entries','organizational_meetings','organizational_weekly_summaries',
    'organizational_replacement_requests','operational_tasks','operational_metrics','org_ui_state_snapshots']
  loop
    if to_regclass('public.'||target) is null then
      raise exception 'Tabela esperada ausente: %. Não continue sem confirmar o schema primeiro (rode 00_preflight.sql).', target;
    end if;
    if not (select relrowsecurity from pg_class where oid = to_regclass('public.'||target)) then
      raise exception 'RLS precisa estar ativo em % antes de revogar o GRANT de anon, senão a tabela também fica inacessível para authenticated.', target;
    end if;
  end loop;
end;
$preconditions$;

revoke select on
  public.candidatos, public.employers, public.employer_openings, public.usuarios,
  public.candidate_employer_matches, public.candidate_employer_links,
  public.organizational_plan_entries, public.organizational_meetings, public.organizational_weekly_summaries,
  public.organizational_replacement_requests, public.operational_tasks, public.operational_metrics,
  public.org_ui_state_snapshots
from anon;

do $verify$
declare target text;
begin
  foreach target in array array['candidatos','employers','employer_openings','usuarios',
    'candidate_employer_matches','candidate_employer_links',
    'organizational_plan_entries','organizational_meetings','organizational_weekly_summaries',
    'organizational_replacement_requests','operational_tasks','operational_metrics','org_ui_state_snapshots']
  loop
    if has_table_privilege('anon', 'public.'||target, 'SELECT') then
      raise exception 'Revogação falhou para %: anon ainda tem SELECT.', target;
    end if;
  end loop;
end;
$verify$;

commit;

-- Verificação pós-aplicação (fora do banco, no terminal, sem credencial
-- nenhuma além da chave anon pública já embutida no site):
--
--   curl -s -o /dev/null -w "%{http_code}\n" \
--     "https://xcxqtjzlqmncwnhbolnl.supabase.co/rest/v1/candidatos?select=id&limit=1" \
--     -H "apikey: <a mesma chave anon de assets/t4-v2-data.js>" \
--     -H "Authorization: Bearer <a mesma chave>"
--
-- Antes: 200. Depois de aplicar este script: 401 (permission denied for
-- table candidatos) — igual ao que já acontece hoje com crm_activities,
-- contact_records e as tabelas de alemão. Repita para as demais 12 tabelas
-- listadas acima.
