# Importação SQL — arquitetura de staging (schema aplicado, frontend ainda não ligado)

**Atualização 2026-09-03 (ver `docs/auditoria/PLANO_MIGRACAO_IMPORTACAO_LOTE.md` para o detalhe completo, script a script):** os 6 scripts de migração abaixo (todos exceto `05_verify_import.sql`, que é consulta manual, não migração) **já foram aplicados com sucesso no Supabase real** e confirmados de forma independente por sondagem somente-leitura via API REST. As 7 tabelas/funções novas existem hoje no banco. Isto substitui a frase "nenhum executado" que estava aqui antes — mantida como nota de rodapé histórica, não como estado atual.

## O que existe hoje (rodando, testado, sem depender deste desenho)

O Centro de Dados (`assets/t4-import-export.js`, `importData()`) já grava direto nas tabelas finais via upsert idempotente (ID determinístico ou casamento por nome), com prévia obrigatória, confirmação explícita, contagem de criados/atualizados/rejeitados e relatório de progresso parcial se uma etapa falhar (ver `t4-import-export.js`, corrigido e testado nesta mesma sessão). **Isso continua sendo o que roda em produção** — o schema de staging descrito abaixo já existe no banco, mas o app ainda não foi religado para usá-lo (ver "Limitações" abaixo). Uma importação real hoje **não tem limite de segurança automático no servidor** — nenhuma trava impede reenviar centenas de linhas por engano; é exatamente o tipo de incidente que motivou este desenho.

## O que este diretório implementa no banco (7 arquivos SQL, 6 já aplicados)

`supabase/talents-v22/import-planilhas/00_preflight.sql` → `01_schema_additive.sql` → `02_create_staging.sql` → `03_load_staging.sql` → `04_apply_import.sql` → `05_verify_import.sql` → `06_rollback_batch.sql`.

Motivação: mover a gravação para dentro de uma transação server-side com limite de segurança explícito (`safety_limit`), em vez de depender só da disciplina do código cliente. Hoje, se o navegador travar no meio de uma importação, algumas tabelas já foram gravadas e outras não (documentado em `assets/t4-import-export.js`, `report.rejected`/`error.importReport`). Com staging, a gravação real só acontece em `04_apply_import.sql`, dentro de uma transação por linha com savepoint — uma falha isolada não trava as demais, e o lote inteiro fica registrado e reversível.

## Fluxo completo

1. **Prévia (já existe, sem staging):** usuário seleciona os 2 arquivos, `T4Workbook.read()` + `T4ImportExport.parseBooks()` mostram contagens e pendências no navegador. Nada é enviado ao Supabase ainda.
2. **Criar lote:** `select public.t4_create_import_batch(source_files, expected_counts, safety_limit)` → retorna `batch_id`.
3. **Carregar staging:** para cada linha que passou na validação do navegador, `select public.t4_stage_import_row(batch_id, ..., p_validation_status)`. Linhas rejeitadas pelo navegador (Talento/empresa não identificado — mesma lógica já existente) são staged com `'rejected'`, preservando o motivo, em vez de nunca chegarem ao banco.
4. **Confirmação explícita do usuário** (checkbox/botão dedicado, mostrando a contagem exata que será aplicada).
5. **Aplicar:** `select public.t4_apply_import_batch(batch_id, true, expected_row_count)`. Aborta sem gravar nada se a contagem real de linhas válidas divergir do esperado ou exceder `safety_limit` — a proteção direta contra o incidente de mais de 200 registros.
6. **Verificar:** `05_verify_import.sql` compara previsto × real × o que está de fato marcado com aquele `import_batch_id` nas tabelas.
7. **Reverter, se necessário:** `select public.t4_rollback_import_batch(batch_id, true)` — apaga só o que o lote criou; registros que já existiam antes e foram só atualizados têm os campos alterados restaurados a partir do snapshot anterior, nunca apagados.

## Idempotência

- `import_source_records` tem `unique (batch_id, source_file, source_sheet, source_row)` — reenviar a mesma linha no mesmo lote atualiza, não duplica.
- `target_key` em `import_rows` é a mesma chave determinística/de casamento por nome já usada pelo importador atual (`deterministicId()`, `stableTalentId()`, `normalizeCompany()` em `assets/t4-import-export.js`) — reaproveitada, não reinventada.
- `04_apply_import.sql` usa `insert ... on conflict (id) do update` — aplicar o mesmo lote duas vezes atualiza os mesmos registros, não cria segundas cópias.

## Limitações atuais (honestas, não escondidas)

- ~~Nenhum destes 7 scripts foi executado~~ — **superado**: 6 dos 7 foram aplicados e verificados em 2026-09-03 (`docs/auditoria/PLANO_MIGRACAO_IMPORTACAO_LOTE.md`).
- **O app (`t4-import-export.js`) continua sem religar para chamar essas funções via RPC — esta é a pendência real, ainda aberta.** O fluxo que roda hoje continua sendo o upsert direto já existente (idempotente, mas sem lote/staging/limite de segurança no servidor). Ligar o app a este desenho está bloqueado por uma decisão de arquitetura ainda não tomada: `scripts/check-v2.mjs` proíbe hoje qualquer chamada `.rpc(` no frontend (verificação introduzida antes deste desenho existir, nunca reconciliada com ele) — chamar `t4_create_import_batch`/`t4_stage_import_row`/`t4_apply_import_batch`/`t4_rollback_import_batch` exigiria relaxar essa proibição para uma lista explícita dessas 4 funções (todas `security invoker`, só `authenticated`, sem acesso a `anon`). Decisão pendente de quem mantém o repositório — não tomada unilateralmente nesta auditoria.
- `04_apply_import.sql` assume que `normalized_payload` já tem exatamente as colunas certas para cada `target_entity` (o app monta esse payload) — um payload com uma chave que não é coluna da tabela falha aquela linha individualmente (fica em `import_errors`), não trava o lote. Ainda não testado contra o banco real linha a linha com dado de importação de verdade (só a criação da função foi confirmada).
