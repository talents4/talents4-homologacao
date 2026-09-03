# Classificação de empresas — Talents 4 × NectaNet

**Base:** as 4 fontes de empresa dos dois arquivos oficiais (`Nectanet Partner 01092026`, `Nectanet Partner`, `Empresas detalhadas`, `Matriz NectaNet`), cruzadas por nome normalizado (minúsculas, espaços colapsados). Resultado completo em `company_classification.json` (gerado nesta sessão, não commitado — ver reprodução abaixo).

## Regra seguida (obrigatória, do prompt)

Nenhuma das quatro fontes tem uma coluna confiável de "parceria direta com a Talents 4". Por isso **`direct_talents4_partnership` nunca foi inferido** — nem do nome da aba, nem do texto "Nectanet Partner"/"Nectanet MATCH", nem da coluna `NectaNet?`, nem de presença de contato/e-mail/vaga. Todo valor abaixo é `UNKNOWN` a menos que a proprietária confirme manualmente.

## Resultado

- **162 empresas únicas** nas 4 fontes combinadas (nome normalizado).
- **100% delas** têm algum sinal NectaNet (`presented_by_nectanet = true`) — não existe, nestes dois arquivos, nenhuma empresa "geral/prospect" fora do universo NectaNet. Isso é consistente com a nota da própria aba "Resumo BW": *"NectaNet = lista exata de 160 empresas revisada"*.
- **79 empresas** aparecem em 2 ou mais das 3 fontes NectaNet (`nectanet_partner_01092026`, `nectanet_partner_old`, `matriz_nectanet`) → `classification_confidence = HIGH` para o sinal de origem NectaNet.
- **83 empresas** aparecem em exatamente 1 fonte NectaNet → `classification_confidence = MEDIUM`.
- **2 empresas** aparecem em fontes NectaNet mas **não** em "Empresas detalhadas" (a lista mestre) — precisam de um registro novo em `employers`, não devem ser tratadas como já existentes:
  - `Ingérop Deutschland GmbH (IDC)`
  - `SWEG`
- **`direct_talents4_partnership = UNKNOWN — REVISÃO NECESSÁRIA` para as 162 empresas**, sem exceção. Este é o item que precisa da decisão da proprietária — nenhuma automação decide isso.

## Dimensões modeladas (campos novos, ver `MAPEAMENTO_SUPABASE.md`)

| Campo | Valor nestes dados | Fonte da evidência |
|---|---|---|
| `presented_by_nectanet` | `true` para 162/162 | presença em qualquer uma das 3 abas/fontes NectaNet |
| `source_channel` | `NECTANET` para 162/162 | idem |
| `direct_talents4_partnership` | `UNKNOWN` para 162/162 | nenhuma coluna confiável existe |
| `partnership_status` | `UNKNOWN` para 162/162 | idem |
| `company_scope` | `NECTANET_PRESENTED` para 162/162 | idem |
| `classification_confidence` | `HIGH` (79) / `MEDIUM` (83) | número de fontes NectaNet independentes que citam a empresa |
| `classification_source` | lista das fontes (ex.: `nectanet_partner_01092026, nectanet_partner_old`) | rastreável por empresa |
| `classification_notes` | decisões manuais já registradas na planilha (ex.: nota da aba "Radar NectaNet": *"Ortenau Klinikum e Klinikum Stuttgart foram corrigidos para 'Não — BW'"*) devem ser preservadas como `classification_notes`, não descartadas | leitura direta do texto da aba |

## Pendências específicas encontradas nos dados reais

1. **2 empresas sem registro em "Empresas detalhadas"** (listadas acima) — criar como novo `employers` na importação, não tentar casar com um registro existente.
2. **1 duplicata exata em "Empresas detalhadas"** (`acrobat GmbH` × 2) — mesmo nome, decidir na revisão manual se as duas linhas se complementam ou se uma é lixo.
3. **A coluna `Talentos aderentes` de "Nectanet Partner 01092026"** é texto livre (não estruturado) — não usar para inferir vínculo Talento↔Empresa automaticamente; guardar como contexto/nota.
4. **Decisões manuais já registradas na planilha** (ex.: Ortenau Klinikum / Klinikum Stuttgart → "Não — BW") devem ser importadas como `classification_notes`, preservando o trabalho humano já feito, não descartadas por não caberem no schema anterior.

## Reprodução

`company_classification.json` foi gerado por um script Python ad-hoc desta sessão que lê as 4 fontes via `openpyxl`, normaliza nomes (minúsculas, espaços colapsados) e cruza por chave normalizada. Não foi commitado ao repositório (ferramenta de análise, não parte do produto) — o resultado consolidado está neste documento. Para reproduzir: repetir a leitura das 4 fontes citadas acima com o motor real do app (`assets/t4-workbook.js`) e aplicar a mesma normalização de `assets/t4-import-export.js` (`normalizeCompany()`).
