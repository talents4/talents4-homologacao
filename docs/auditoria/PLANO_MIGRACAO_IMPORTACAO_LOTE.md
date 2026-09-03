# Plano de aplicação — arquitetura de importação em lote (staging + rollback)

**Status: APLICADA COM SUCESSO em 2026-09-03.** Os 6 scripts, na ordem abaixo, foram executados pelo usuário no SQL Editor. Confirmado de forma independente (sondagem somente-leitura via API REST, mesma técnica de `docs/auditoria/AUDITORIA_SUPABASE_INTEGRACAO.md`): as 7 tabelas novas foram de "não existe" (404) para "existe, sem grant anon" (401 — correto, são `authenticated`-only) e as 8 colunas de classificação em `employers` foram de erro de coluna para `200 OK`. Um bug real de sintaxe SQL foi encontrado e corrigido durante a aplicação — ver histórico do commit `c646b5e` e a seção "O que foi corrigido durante a aplicação real" no fim deste documento.

Você aprovou aplicar esta arquitetura (opção "Aplicar a arquitetura de lote", 2026-09-02). Este documento é o que a regra de conduta exige antes de qualquer migração real: SQL, impacto, pré-requisitos, estratégia de rollback, validações e estimativa de registros afetados — script por script, na ordem exata de aplicação. Os 3 bugs reais encontrados ao revisar este plano antes da aplicação (ver `docs/auditoria/AUDITORIA_SUPABASE_INTEGRACAO.md`) já tinham sido corrigidos nos arquivos antes deste documento ser escrito; um quarto bug real (de sintaxe) só apareceu ao rodar de verdade — ver o fim do documento.

## Ordem de aplicação (não pular, não inverter)

```
1. supabase/talents-v22/10_additive.sql              (cria talent_mapping_profiles/items/partners)
2. supabase/talents-v22/import-planilhas/01_schema_additive.sql  (classificação de empresa + import_batch_id)
3. supabase/talents-v22/import-planilhas/02_create_staging.sql  (4 tabelas de staging)
4. supabase/talents-v22/import-planilhas/03_load_staging.sql    (2 funções RPC — só definição, não roda nada)
5. supabase/talents-v22/import-planilhas/04_apply_import.sql    (1 função RPC — só definição, não roda nada)
6. supabase/talents-v22/import-planilhas/06_rollback_batch.sql  (1 função RPC — só definição, não roda nada)
```

`05_verify_import.sql` não é uma migração — é uma consulta de leitura que você roda manualmente depois de cada importação real, com o `batch_id` do lote. Não precisa ser "aplicada".

Rode cada script **numa consulta nova do SQL Editor**, um de cada vez, esperando o anterior terminar com sucesso antes do próximo. Todos os 6 já têm `begin`/`commit` com verificação de pré-condição própria — se algo estiver errado, o script inteiro é desfeito automaticamente (nenhum aplica parte de si mesmo).

---

## 1. `10_additive.sql`

- **O que faz:** cria 3 tabelas (`talent_mapping_profiles`, `talent_mapping_items`, `talent_mapping_partners`), 9 colunas novas em `candidatos` (todas `text`, todas `add column if not exists`), 4 funções (`t4_talents_v22_access`, `_touch`, `_check_item`, `_check_profile`), RLS + policies nas 3 tabelas novas.
- **Impacto:** aditivo puro. Não altera, não apaga, não regrava nenhuma linha existente em `candidatos`/`employers`/qualquer tabela já usada pelo app. As 3 tabelas novas nascem vazias.
- **Pré-requisitos:** nenhum objeto homônimo já deve existir (o script verifica e recusa reaplicar). Confirmado pelo seu `00_preflight.sql`: ausentes, sem conflito.
- **Estratégia de rollback:** o script inteiro está em uma transação (`begin`/`commit`); qualquer falha de pré-condição ou da verificação final desfaz tudo sozinho, sem ação sua. Depois de aplicado com sucesso, reverter manualmente = `drop table` das 3 tabelas + `drop function` das 4 funções + remover as 9 colunas de `candidatos` (script de reversão não incluído porque, uma vez usado por uma importação real, as tabelas teriam dado com dados reais — nesse ponto a decisão de apagar deixa de ser técnica e passa a ser sua).
- **Validações internas:** verifica tipos de coluna esperados em `candidatos`/`employers`/`employer_openings`/`usuarios` antes de tocar em qualquer coisa (bloco `$preconditions$`); verifica ao final, na mesma transação, que `anon` não ganhou nenhum privilégio nas tabelas novas e que `authenticated` não ganhou `DELETE`/`TRUNCATE`/`TRIGGER` (bloco `$verify$`, linhas 253-264) — se a verificação falhar, desfaz tudo.
- **Registros afetados:** 0 linhas de dado de negócio tocadas. Só schema (DDL).

## 2. `01_schema_additive.sql`

- **O que faz:** adiciona 8 colunas de classificação em `employers` (todas `text`/`boolean`, com `check` fixando os valores aceitos — nunca aceita um valor fora da lista fechada) e 1 coluna `import_batch_id uuid` em 5 tabelas (`candidatos`, `employers`, `talent_mapping_profiles/items/partners`).
- **Impacto:** aditivo puro. Toda coluna nasce `null` em toda linha existente — nenhum badge de classificação passa a mostrar "Parceira Talents 4" ou qualquer outro selo sozinho; a UI já trata a ausência de dado como "Classificação pendente" (comportamento já testado, `tests/employer-classification.test.mjs`).
- **Pré-requisitos:** exige que as 5 tabelas alvo já existam — por isso vem depois de `10_additive.sql`, nunca antes.
- **Estratégia de rollback:** transação própria; falha de pré-condição desfaz tudo. Depois de aplicado: `alter table ... drop column` nas 8+5 colunas (seguro enquanto nenhuma tiver sido preenchida por uma importação real).
- **Validações internas:** confirma ao final, na mesma transação, que as 8 colunas de classificação realmente existem em `employers` (bloco `$verify$`).
- **Registros afetados:** 0 linhas de dado de negócio tocadas (`add column` sem `default` grava `null` em toda linha existente, sem reescrever o valor de nenhum campo já preenchido).

## 3. `02_create_staging.sql`

- **O que faz:** cria as 4 tabelas de staging (`import_batches`, `import_source_records`, `import_rows`, `import_errors`), com RLS, policies (usando a função de autorização já criada em `10_additive.sql`) e grants (`authenticated`: select/insert/update, sem delete — nada em staging é apagado, só marcado; `service_role`: tudo; `anon`: nada).
- **Impacto:** aditivo puro, tabelas novas nascem vazias. Não toca em `candidatos`/`employers`/`talent_mapping_*`.
- **Pré-requisitos:** função `public.t4_talents_v22_access(boolean)` já deve existir (criada em `10_additive.sql`).
- **Estratégia de rollback:** transação própria. Depois de aplicado, sem nenhuma importação real ainda feita: `drop table` das 4, em qualquer ordem (o `on delete cascade` entre elas cuida da ordem se você apagar só `import_batches`).
- **Validações internas:** verifica ao final, na mesma transação, que `anon` não tem nenhum privilégio nas 4 tabelas e que RLS está ligado em todas (bloco `$verify$`).
- **Registros afetados:** 0.

## 4. `03_load_staging.sql`

- **O que faz:** cria 2 funções (`t4_create_import_batch`, `t4_stage_import_row`) que o frontend vai chamar via RPC durante a prévia de uma importação real. **Aplicar este script não executa nenhuma importação** — só define as funções, prontas para serem chamadas depois.
- **Impacto:** zero até a primeira chamada real dessas funções (que só vai acontecer quando eu conectar o frontend a elas — ainda não fiz isso, ver próxima seção).
- **Pré-requisitos:** tabelas de staging já devem existir (`02_create_staging.sql`).
- **Estratégia de rollback:** transação própria. Depois: `drop function` das 2.
- **Validações internas:** `t4_stage_import_row` recusa gravar se `validation_status` vier `'pending'` (o chamador é obrigado a já ter decidido `valid`/`rejected`/`needs_review` antes de chamar — nunca fica uma linha em limbo).
- **Registros afetados:** 0 (definição de função).

## 5. `04_apply_import.sql`

- **O que faz:** cria a função `t4_apply_import_batch` — a **única** desta série que grava em `candidatos`/`employers`/`talent_mapping_*`, e só quando chamada de verdade, mais tarde, por uma importação real já revisada.
- **Impacto ao aplicar o script (criar a função): zero.** Impacto **quando a função for chamada no futuro**: aborta sem gravar nada se a contagem real de linhas válidas não bater com a esperada, ou se ultrapassar o `safety_limit` do lote (200 por padrão, ver correção desta rodada). Linhas que passam nas duas checagens são gravadas uma a uma, em savepoint próprio — uma falha isolada numa linha não derruba o lote inteiro, só marca aquela linha como rejeitada com o motivo exato do erro.
- **Pré-requisitos:** `import_rows` deve existir.
- **Estratégia de rollback do script em si:** transação própria, `drop function` depois se necessário. **Estratégia de rollback de uma importação já aplicada:** é o próximo script, `06_rollback_batch.sql` — não um `DROP`, um desfazimento controlado por lote.
- **Validações internas:** confirmação explícita obrigatória (`p_confirm = true`); contagem prevista vs. real precisa bater exatamente; nunca ultrapassa o limite de segurança do lote.
- **Registros afetados por aplicar o script:** 0. **Por uma chamada futura da função:** no máximo `safety_limit` linhas (200 por padrão), nunca mais — é a garantia central deste pedido.
- **Contrato que o código do frontend (ainda não escrito) precisa respeitar:** `normalized_payload` deve sempre incluir a chave `"id"` — tanto para linha nova quanto para atualização de uma existente (`existing_target_id` preenchido). Sem isso, a linha seria inserida com `id = null` e rejeitada pelo próprio savepoint da função (falha contida, não quebra o lote, mas a linha não seria aplicada). Vou garantir isso quando escrever a integração do frontend.

## 6. `06_rollback_batch.sql`

- **O que faz:** cria a função `t4_rollback_import_batch`. Restaura campo a campo (do snapshot salvo em `import_rows.previous_value_snapshot`) tudo que o lote **atualizou** em registros que já existiam antes; **apaga por completo** só os registros que o lote **criou do zero**. Nunca apaga um registro que já existia antes da importação.
- **Impacto ao aplicar o script (criar a função): zero.** Impacto **quando chamada no futuro**: como descrito acima, escopado estritamente ao `batch_id` informado.
- **Pré-requisitos:** as tabelas/colunas de todos os passos anteriores.
- **Estratégia de rollback do script em si:** transação própria. **Estratégia de rollback de um rollback**: não existe — reverter um lote é uma ação final para aquele lote (o `status` vai para `'rolled_back'` e a função recusa rodar de novo no mesmo lote). Por isso `t4_apply_import_batch` sempre roda antes numa prévia/lote pequeno, nunca direto em produção sem antes ter sido testado num lote de poucas linhas.
- **Validações internas (corrigidas nesta rodada):** cada campo restaurado agora usa o tipo real da coluna (lido de `information_schema`), não mais um `::text` fixo — o bug anterior faria a reversão inteira falhar (com segurança, sem gravar nada pela metade) sempre que o lote tivesse tocado uma coluna não-texto.
- **Registros afetados por aplicar o script:** 0. **Por uma chamada futura:** exatamente o universo de linhas daquele `batch_id`, nunca mais.

---

## O que ainda falta depois de você aplicar os 6 scripts

Aplicar este SQL cria a capacidade no banco, mas **não conecta o frontend a ela** — hoje `assets/t4-import-export.js` continua gravando direto nas tabelas de produção, sem passar pelo staging. Ligar as duas pontas (trocar o fluxo de importação do app para: prévia → `t4_create_import_batch` → `t4_stage_import_row` por linha → confirmação → `t4_apply_import_batch` → relatório, com botão de "desfazer este lote" chamando `t4_rollback_import_batch`) é a próxima etapa de código, ainda não feita — vou fazer isso depois que você aplicar este SQL (para poder testar de verdade contra as tabelas reais, não só ler o código).

## Checklist antes de aplicar

- [x] Backup/point-in-time recovery do banco confirmado disponível no painel do Supabase (prática padrão antes de qualquer DDL em produção, mesmo aditivo)
- [x] Rodar na ordem exata listada acima, um script por vez, cada um numa consulta nova
- [x] Depois de cada script, confirmar que terminou com "Success" — se der erro, **parar e me colar o erro** antes de tentar o próximo
- [x] Depois dos 6, nenhuma tela do app muda de comportamento visível (as funções novas não são chamadas por nada ainda) — isso é esperado, não um sinal de que algo falhou

## O que foi corrigido durante a aplicação real (2026-09-03)

`10_additive.sql` falhou na primeira tentativa: `ERROR: 42601: syntax error at end of input`, linha 202, dentro da função `t4_talents_v22_check_profile()`. Causa: um `CASE...END` aninhado direto na condição de um `IF`, que por sua vez estava dentro de outro `IF` dentro de um `FOREACH` — o `END` do `CASE` seguido imediatamente pelo `THEN` do `IF` externo confundia o parser do PL/pgSQL. Eu não tinha (e ainda não tenho) acesso a um Postgres real para testar este SQL antes de entregar — a revisão manual não pegou isso.

Corrigido extraindo o `CASE` para uma variável própria (`previous_best`) antes do `IF`, deixando a condição simples (uma comparação direta). Depois de revisar os 6 arquivos inteiros de novo procurando o mesmo padrão (nenhuma outra ocorrência encontrada), a nova tentativa teve sucesso, junto com os outros 5 scripts em sequência. Commit `c646b5e`.

**Lição registrada para o futuro:** SQL entregue sem um Postgres real para testar contra pode ter erro de sintaxe genuíno mesmo depois de revisão cuidadosa — a resposta certa quando isso acontece é corrigir rápido, revisar o arquivo inteiro (e os relacionados) procurando o mesmo padrão, e ser honesto que não dá para garantir 100% sem execução real.

## Confirmação independente pós-aplicação (2026-09-03)

Sondagem somente-leitura via API REST (mesma chave anon pública, mesma técnica de `AUDITORIA_SUPABASE_INTEGRACAO.md`):

| Objeto | Antes | Depois |
|---|---|---|
| `talent_mapping_profiles`, `talent_mapping_items`, `talent_mapping_partners` | `404 PGRST205` (não existe) | `401 permission denied` (existe, só `authenticated`) |
| `import_batches`, `import_source_records`, `import_rows`, `import_errors` | `404 PGRST205` | `401 permission denied` |
| `employers.presented_by_nectanet` / `.direct_talents4_partnership` / `.company_scope` | `42703 column does not exist` | `200 OK` |

Todos os 7 objetos e as 8 colunas de classificação confirmados presentes com a postura de segurança correta (bloqueados para `anon`, abertos só para `authenticated` via as policies já criadas).
