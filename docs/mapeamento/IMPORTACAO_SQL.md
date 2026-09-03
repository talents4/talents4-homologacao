# Importação SQL — arquitetura de staging (proposta, não aplicada)

## O que existe hoje (rodando, testado, sem depender deste desenho)

O Centro de Dados (`assets/t4-import-export.js`, `importData()`) já grava direto nas tabelas finais via upsert idempotente (ID determinístico ou casamento por nome), com prévia obrigatória, confirmação explícita, contagem de criados/atualizados/rejeitados e relatório de progresso parcial se uma etapa falhar (ver `t4-import-export.js`, corrigido e testado nesta mesma sessão). **Isso continua sendo o que roda em produção** — nada nesta seção foi ligado ao fluxo real do app.

## O que este diretório propõe (7 arquivos SQL, nenhum executado)

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

## Limitações desta entrega (honestas, não escondidas)

- **Nenhum destes 7 scripts foi executado.** Precisam passar por `00_preflight.sql` e revisão humana antes de ir para o SQL Editor real.
- **O app (`t4-import-export.js`) não foi religado para chamar essas funções via RPC.** O fluxo que roda hoje continua sendo o upsert direto já existente (mais seguro que antes desta sessão, mas sem staging). Ligar o app a este desenho é um passo separado, que precisa de um banco real para testar o `INSERT ... jsonb_populate_record` dinâmico em `04_apply_import.sql` linha a linha antes de confiar nele com dados reais — não é responsável fazer isso sem esse teste.
- `04_apply_import.sql` assume que `normalized_payload` já tem exatamente as colunas certas para cada `target_entity` (o app monta esse payload) — um payload com uma chave que não é coluna da tabela falha aquela linha individualmente (fica em `import_errors`), não trava o lote.
