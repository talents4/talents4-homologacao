# Mapeamento planilha → Supabase

## Reaproveitamento de schema (obrigatório, do prompt)

Nenhuma tabela nova foi criada para uma entidade que já existe. Reaproveitadas: `candidatos`, `employers`, `employer_openings`, `talent_opportunity_matches`, `candidate_employer_matches`, `candidate_employer_links`, `talent_mapping_profiles`, `talent_mapping_items`, `talent_mapping_partners`, `contact_records`, `contact_interactions`, `crm_activities` — todas já existentes no contrato do frontend (`supabase/talents-v22/30_frontend_schema_audit.sql`, auditado nesta mesma sessão de trabalho).

**Novo, e por quê:** 8 colunas de classificação em `employers` (Seção "Classificação de empresas" abaixo) — não existe hoje nenhuma coluna que capture `source_channel`/`company_scope`/etc., e o prompt exige explicitamente essas dimensões. Mais `import_batch_id` em 5 tabelas (rastreio de lote, permite reversão cirúrgica). Mais 4 tabelas de staging (`import_batches`, `import_source_records`, `import_rows`, `import_errors`) — não há hoje nenhuma estrutura equivalente; sem staging, a única forma de auditar "o que essa importação específica gravou" é o histórico de `updated_at`, que não distingue uma importação de uma edição manual.

## Tabela alvo por dado da planilha

| Dado da planilha | Tabela | Coluna(s) | Transformação |
|---|---|---|---|
| Candidatos priorizados → Nome, Idade, Área, Alemão, CV, Resumo | `candidatos` | `nome_completo`, `idade`, `area_profissional`, `nivel_alemao`, `cv_drive_web_link`, `perfil_profissional_para_apresentacao` | Idade convertida para texto (schema atual aceita texto ou número, ver `00_preflight.sql` do talents-v22 original); demais campos copiados |
| Candidatos priorizados → Lista Nectanet, Visto, Profissional Qualificado, Novo CV, Cluster, Inglês, Outros idiomas, Observação | `talent_mapping_profiles` | `lista_nectanet`, `visto`, `profissional_qualificado`, `novo_cv`, `cluster`, `ingles`, `outros_idiomas`, `observacao_apresentacao` | `lista_nectanet` normalizado para `Sim`/`Não` |
| Candidatos priorizados → Empresa principal/alternativa 1/2 | `talent_mapping_profiles` | `employer_primary_id`, `employer_alt1_id`, `employer_alt2_id` | Nome → `employers.id` via `registerEmployer()` (cria se não existir, casando por nome normalizado) |
| Nectanet Partner (antiga) | `talent_mapping_partners` | `id` (= `employers.id`), `is_nectanet`, `source`, `ceo_name`, `ceo_email`, `hr_name`, `hr_email`, `contact_status`, `notes` (com snapshot JSON dos campos calculados por fórmula, ver `CONTRATO_PLANILHAS.md`) | — |
| **Nectanet Partner 01092026 (nova, esta entrega)** | `employers` (classificação) | `presented_by_nectanet`, `source_channel`, `company_scope`, `classification_confidence`, `classification_source` | Empresa criada/casada por nome; CEO/HR/status ficam como sinal de classificação, não persistidos em coluna própria hoje (candidatos a `talent_mapping_partners` numa iteração futura, já que essa tabela já tem `ceo_name`/`hr_name`) |
| Empresas detalhadas | `employers` | `nome`, `area_atuacao`, `perfis_buscados`, `descricao_resumida` | `E-mail para envio` **não** vai para `email_principal` (é corpo de e-mail, não endereço — ver `CONTRATO_PLANILHAS.md`); fica pendente de um campo de nota, não implementado nesta entrega |
| **Matriz NectaNet (nova, esta entrega)** | `employers` (classificação) | `presented_by_nectanet`, `source_channel`, `company_scope`, `classification_confidence`, `classification_source` | Só alimenta classificação de empresa; a aderência por Talento (`ALTA`/`MÉDIA`/`MONITORAR`) **não** é persistida como vínculo Talento↔vaga (a própria aba avisa que mede aderência de ambiente, não vaga aberta) |
| Abas de Talento (16 colunas) | `talent_mapping_items` | `employer_id`, `nectanet`, `vacancy_status`, `professional_score`, `current_viability_score`, `projected_b1_score`, `vacancy_situation`, `type_area`, `fit_reasons`, `barriers`, `language_requirement`, `recognition_requirement`, `location`, `contact`, `official_url`, `verified_on` | Já implementado antes desta entrega; sem alteração |
| Radar NectaNet | `talent_mapping_items` | mesmas colunas acima, `nectanet` forçado para `'Sim'` | Já implementado |
| Resumo BW, Matriz NectaNet (colunas por Talento) | — | — | **Nunca fonte primária** — recalculadas na exportação a partir dos dados normalizados, conforme o prompt exige |

## Classificação de empresas — colunas novas em `employers`

Ver `01_schema_additive.sql` para o DDL completo e `CLASSIFICACAO_EMPRESAS.md` para os valores reais encontrados nas planilhas fornecidas.

| Coluna | Tipo | Valores aceitos |
|---|---|---|
| `presented_by_nectanet` | boolean | — |
| `source_channel` | text | `NECTANET`, `TALENTS4_DIRECT`, `OTHER`, `UNKNOWN` |
| `direct_talents4_partnership` | text | `UNKNOWN`, `CONFIRMADA`, `REJEITADA` — só muda de `UNKNOWN` por ação humana explícita, nunca pela importação |
| `partnership_status` | text | `ACTIVE`, `PROSPECT`, `FORMER`, `PAUSED`, `UNKNOWN` |
| `company_scope` | text | `GENERAL`, `NECTANET_PRESENTED`, `TALENTS4_PARTNER`, `EXTERNAL_BW`, `UNKNOWN` |
| `classification_confidence` | text | `HIGH`, `MEDIUM`, `LOW` |
| `classification_source` | text | lista das fontes (ex.: `"nectanet_partner_novo, matriz_nectanet"`) |
| `classification_notes` | text | decisões manuais já registradas na planilha (ex.: correções de "Não — BW") |

## Campos da planilha sem destino confirmado no Supabase hoje

| Campo | Por quê | Classificação |
|---|---|---|
| `Empresas detalhadas.E-mail para envio` (corpo de e-mail em alemão) | Não é um endereço; não há coluna de "rascunho de prospecção" em `employers` nem `crm_activities` dedicada a isso ainda | NÃO PERSISTIDO nesta entrega — pendência de contrato, não descartado silenciosamente (fica no arquivo original, disponível para uma decisão futura) |
| `Nectanet Partner 01092026.Talentos aderentes` (texto livre com bullets) | Não estruturado; extrair vínculo Talento↔Empresa dali com confiança exigiria parsing de linguagem natural | NÃO PERSISTIDO como vínculo — mantido apenas como contexto ao classificar a empresa (não gravado em coluna própria nesta entrega) |
| `Matriz NectaNet` (aderência ALTA/MÉDIA/MONITORAR por Talento×Empresa) | A própria aba avisa que mede aderência de ambiente, não vaga aberta — persistir isso como uma seleção real seria uma inferência indevida | NÃO PERSISTIDO como vínculo; usado só para o sinal binário "esta empresa aparece na Matriz" (classificação) |

## Bloqueio de validação ao vivo

`AUDITORIA PARCIAL — Supabase não pôde ser validado nesta sessão.` Sem acesso a SQL Editor/conexão Postgres direta, o desenho acima foi feito reaproveitando o contrato já confirmado por leitura de código na auditoria anterior desta mesma conversa (`supabase/talents-v22/30_frontend_schema_audit.sql`) e por uma sondagem real via API REST (chave `anon` pública, somente leitura) que confirmou tabela por tabela quais existem hoje no projeto conectado — ver o relatório de auditoria anterior desta conversa para o detalhe dessa sondagem. As 8 colunas novas de classificação e as 4 tabelas de staging **não foram confirmadas contra o banco real** — o SQL em `01_schema_additive.sql`/`02_create_staging.sql` precisa passar por `00_preflight.sql` antes de ser aplicado.
