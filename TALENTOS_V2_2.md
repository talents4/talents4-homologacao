# Talentos 2.2 · acompanhamento e apresentação conforme as planilhas

Revisão incremental de **Talentos**, sobre `talents4/talents4-homologacao` no commit `fa6ecb466b22c4344090a784edddeeb9465eeb7c` (conferido em 01/09/2026). Os três outros módulos e todos os componentes compartilhados permanecem com os mesmos arquivos de execução.

**Estado da entrega:** implementação local e testes simulados concluídos. Não foi publicada nem executada no Supabase real. Os campos adicionais foram preparados em SQL, não aplicados. A validação visual no navegador e o teste autenticado continuam pendentes.

Leia primeiro [PASSO_A_PASSO_TALENTOS_V2_2.md](./PASSO_A_PASSO_TALENTOS_V2_2.md).

## Uso diário

- A abertura leva à **Base de talentos**: busca, várias etapas/idiomas/responsáveis/empregadores ao mesmo tempo, motivo da atenção, liberação para apresentação e atalhos para acompanhamento/ficha.
- Dentro de um grupo de filtro, as opções se somam (**OU**). Grupos diferentes se cruzam (**E**). Exemplo: `(Triagem OU Análise) E (A2 OU B1)`.
- Os filtros rápidos também podem ser combinados. “Em acompanhamento de alemão” + “Atenção” mostra apenas quem atende aos dois critérios. “Todos os talentos” retira filtros rápidos; “Limpar filtros” limpa também os demais critérios e a busca.
- As opções têm busca, caixas de seleção e contagem considerando os demais grupos. As opções escolhidas ficam visíveis e podem ser retiradas individualmente.
- Seleções, oportunidades e agenda possuem seus próprios filtros múltiplos. Não alteram silenciosamente os filtros da base.
- Filtros, colunas e seleção de tela ficam na memória da sessão; não são gravados como dados de negócio nem enviados a Google Planilhas.
- **Acompanhar** abre a ficha de trabalho por empresa/vaga. **Ficha** conserva a consulta dos dados completos, histórico, documentos, aulas, seleções e PDF já existentes.
- **Preparar Nectanet**, dentro da ficha, permite preencher os complementos antes da liberação. Os dados canônicos continuam em **Editar ficha**. **Revisar liberação** é uma decisão separada.
- **Prontos para apresentar** abre a grade de 18 colunas, e não o antigo resumo de poucas colunas. Clique em um campo para editar. Nome abre a ficha; empresa de acompanhamento abre a edição da linha.
- Cabeçalhos e identificação ficam fixos na grade larga em telas maiores. Há rolagem horizontal/vertical, paginação de 25 linhas, ordenação, seleção de colunas e modo compacto. O primeiro identificador permanece obrigatório. Os menus são utilizáveis por teclado; ainda devem passar pela conferência visual/assistiva no navegador.

Não foi adicionado envio automático, importação de pessoas, arrastar cartões ou execução de macros.

## Regra de liberação, sem equivalências inventadas

| Informação | Significado |
|---|---|
| `pronto_para_employer` | Liberação registrada pela equipe. Somente valores afirmativos entram em “Prontos para apresentar”. |
| Etapa geral do Talento | Continua a etapa existente. Estar em uma etapa chamada “Pronto” não substitui a revisão da liberação. |
| Lista Nectanet | Campo Sim/Não da planilha. Independente da liberação. |
| Status no acompanhamento | Situação da vaga, não etapa da seleção e não situação do Talento. |
| Aderência profissional | Avaliação manual 0–100, específica da vaga. Não reutiliza o score geral antigo como se fosse aderência profissional. |
| Viabilidade atual | Avaliação manual separada, com as condições conhecidas hoje. |
| B1 em 3 meses | Cenário manual projetado; não muda o alemão atual, não promete aprovação e não remove requisitos de reconhecimento/documentação. |
| Score vazio | Ainda não avaliado. Não é zero. |
| Melhor NectaNet / melhor BW externa | Escolha humana de uma linha do mesmo Talento. Não é selecionada automaticamente pelo maior score. |

## Contrato Nectanet: 18 colunas

Fonte: aba `Candidatos priorizados`, intervalo estrutural `A:R` do arquivo **Mapeamento candidatos - Nectanet(1).xlsm**. A ordem inicial é preservada. “Resumo do candidato” recebe apenas o rótulo “Resumo do Talento” para manter a terminologia da interface; não muda seu significado.

| # | Coluna de apresentação | Origem / campo |
|---|---|---|
| 1 | Lista Nectanet | `talent_mapping_profiles.lista_nectanet` |
| 2 | Nome | `candidatos.nome_completo` |
| 3 | Visto | `talent_mapping_profiles.visto` |
| 4 | Profissional Qualificado | `talent_mapping_profiles.profissional_qualificado` |
| 5 | Novo CV | `talent_mapping_profiles.novo_cv` |
| 6 | CV | `candidatos.cv_drive_web_link` — somente link |
| 7 | Idade | `candidatos.idade` — preserva o texto existente |
| 8 | Área principal | `candidatos.area_profissional` |
| 9 | Cluster | `talent_mapping_profiles.cluster` |
| 10 | Anos de experiência | `candidatos.experiencia_profissional_tempo` — aceita texto |
| 11 | Alemão | `candidatos.nivel_alemao` — nível do perfil; aulas continuam separadas |
| 12 | Inglês | `talent_mapping_profiles.ingles` |
| 13 | Outros idiomas | `talent_mapping_profiles.outros_idiomas` |
| 14 | Empresa principal | `employer_primary_id` → empresa canônica |
| 15 | Empresa alternativa 1 | `employer_alt1_id` → empresa canônica |
| 16 | Empresa alternativa 2 | `employer_alt2_id` → empresa canônica |
| 17 | Resumo do Talento | `candidatos.perfil_profissional_para_apresentacao` |
| 18 | Observação | `talent_mapping_profiles.observacao_apresentacao` |

Se o resumo de apresentação estiver vazio, o resumo RH anterior aparece com indicação de origem e de que ainda não foi revisado para apresentação. Não é copiado automaticamente. Inglês anteriormente cadastrado em `lingua_estrangeira` / `nivel_lingua_estrangeira` também pode aparecer com a origem identificada; o campo novo não é preenchido silenciosamente.

As opções de qualificação oferecem `Fachkraft`, `Azubi`, `Junior`, `Técnico` e `Não`. A validação original contém a grafia `Fachfraft`; valores antigos/desconhecidos continuam visíveis, sem reescrita automática. Textos de idiomas, visto e experiência não são reduzidos a categorias que descartariam detalhes.

### Abas auxiliares da mesma planilha

**Nectanet Partner**, 13 colunas: `nectanet source`, `Unternehmen`, `Geschäftsführer`, `Kontakt-E-Mail`, `Personaler`, `Kontakt-E-Mail 2`, `Kontaktstatus`, `Anzahl Talente`, `Passende Talente`, `Arbeitsbereich`, `Deutschniveau`, `Englischniveau`, `PS`. Os rótulos de pessoas usam “Talente” no lugar de “Kandidaten”, mantendo o significado. As contagens e listas vêm dos IDs de empresas principal/alternativas dos Talentos do recorte, sem duplicar a pessoa por empresa.

**Empresas detalhadas**, 5 colunas: Empresa, Setor / tipo, Vagas em aberto, Descrição da empresa, E-mail para envio. Nome, setor, descrição e vagas estruturadas usam `employers` e `employer_openings`. Complementos da parceria ficam em `talent_mapping_partners`; não substituem o cadastro do Organizacional.

Não foram copiadas as fórmulas de intervalo fixo da planilha nem seus possíveis nomes repetidos. A grade consulta todos os registros carregados dentro do limite explícito de segurança; exceder o limite causa aviso/erro, não um total truncado apresentado como completo.

## Contrato do acompanhamento: 16 colunas

Fonte: abas individuais de **Cópia de Mapeamento Talents 4 2026.08.31(1).xlsx**. Cabeçalho do Talento, perfil comprovado, idiomas, regra da revisão e premissa da projeção são preservados como contexto acima da grade.

| # | Coluna | Campo / origem |
|---|---|---|
| 1 | Empresa | `employer_id` → nome canônico; ou `employer_name` para alvo ainda não cadastrado |
| 2 | NectaNet? | `nectanet` ou classificação registrada da parceria |
| 3 | Status | Situação da vaga canônica ou `vacancy_status` |
| 4 | Aderência profissional | `professional_score` |
| 5 | Viabilidade atual | `current_viability_score` |
| 6 | Viabilidade projetada — B1 em 3 meses | `projected_b1_score` |
| 7 | Vaga / situação | Vaga canônica ou `vacancy_situation` |
| 8 | Tipo / área | Vaga canônica ou `type_area` |
| 9 | Por que se encaixa | `fit_reasons` |
| 10 | Barreira / risco | `barriers` |
| 11 | Idioma / requisito | Vaga canônica ou `language_requirement` |
| 12 | Anerkennung / Approbation | Vaga canônica ou `recognition_requirement` |
| 13 | Local | Vaga canônica ou `location` |
| 14 | Contato | `contact` ou contato principal do empregador |
| 15 | Link direto / oficial | Vaga canônica ou `official_url` |
| 16 | Verificado em | `verified_on` + `verification_notes`; data da vaga como alternativa identificável |

As seleções existentes aparecem mesmo sem um complemento novo. Editar uma delas cria apenas a linha complementar ligada à sua origem; não recria a seleção. Vaga já acompanhada não deve gerar outra linha. Prospectar uma empresa por nome livre não cria um empregador no Organizacional. Vincular uma vaga já cadastrada usa os dados dela; para mudar esses dados oficiais, abra o Organizacional.

**Resumo BW**, 12 colunas: Talento, Perfil, Itens mapeados, Vagas abertas, NectaNet abertas, Abertas fit ≥90, Abertas viab. atual ≥60, Abertas viab. B1 ≥60, Melhor NectaNet, Melhor BW externa, Barreira principal, Prioridade. Somente situação `ABERTA`/`Aberta` entra nas contagens de vagas abertas; não são incluídos resultados desconhecidos.

**Radar NectaNet**, 11 colunas: Empresa, Talento(s), Status, Aderência, Viab. atual, Viab. B1 (3 meses), Vaga / alvo, Barreira / observação, Local, Link, Verificado em. Cada avaliação continua ligada a uma pessoa/vaga; scores diferentes não são misturados numa média sem significado.

## Supabase e preservação

Três tabelas complementares, em relação com os IDs existentes:

- `talent_mapping_profiles`: uma por Talento; contexto e preparação Nectanet.
- `talent_mapping_items`: linhas de acompanhamento, scores e vínculo opcional com a seleção anterior.
- `talent_mapping_partners`: uma por empregador; complementos da parceria.

O SQL adiciona no máximo nove campos canônicos **somente quando ausentes**, sem converter tipos nem preencher linhas antigas. Nomes, pessoas, avaliações, empresas ou currículos das planilhas não são importados. Não há macros nem arquivos reais no pacote.

O acesso às tabelas novas exige autenticação, perfil interno ativo e permissão de leitura do registro principal. Escrita exige perfil de edição. Acesso anônimo é revogado. Não há política nem permissão de DELETE para usuários da interface. Há validação de vínculos, limites de score, unicidade e marcadores de atualização para edição concorrente. As políticas e funções anteriores não são substituídas.

Esses controles foram revisados no código, mas **não foram executados nem validados contra o banco real**. RLS e privilégios precisam ser testados com os papéis corretos: executar como proprietário no SQL Editor não demonstra sozinho o acesso de um usuário normal. Referências: [políticas RLS do PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) e [RLS no Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

As novas tabelas não são adicionadas automaticamente à publicação Realtime. Atualizar e retornar à aba recarregam os dados; configurar Realtime é uma etapa separada. Os campos canônicos continuam nas fontes já compartilhadas entre os quatro módulos.

### Ausência de tabela não é ausência de dados

Sem aplicar o SQL, a base e as fontes antigas permanecem consultáveis, mas surge aviso de leitura parcial e a edição dos complementos fica bloqueada. Não interprete campos complementares vazios como perda de informações. Quando existir uma falha depois de uma leitura bem-sucedida, a última leitura pode ser mantida **com aviso de desatualização**.

Homologação usa o mesmo Supabase do sistema principal. Uma mudança salva na ficha canônica pode aparecer nos outros módulos e no sistema principal. Separar repositórios não isola o banco. A prévia fornecida é a alternativa sem acesso a dados reais.

## Verificação e limites

```sh
node scripts/check-v2.mjs
node --test tests/*.test.mjs
```

Os testes executam o código real com DOM e Supabase simulados. Cobrem filtros, contratos das colunas, formulários, preservação de campos, concorrência, ausência de fontes, separação de scores, prontidão, vínculos e regras dos outros módulos. Os testes de SQL são **contratos textuais**, não execução PostgreSQL. Não houve teste visual de navegador, autenticação real, envio de documentos ou execução de migration.

Não há um rollback que apague tabelas/dados. Para voltar a interface, restaure apenas os arquivos de Talentos da versão anterior; mantenha os complementos no banco. Desfazer um dado já salvo exige uma decisão específica, não trocar o HTML.

### Identificação das referências

Os anexos reenviados são idênticos aos anteriores:

- Nectanet SHA-256: `ae74efa7208aa2a196cc9399bb031c19465b8db6d562eb94d97a3b954fbe1cf7`.
- Acompanhamento SHA-256: `9aa33afc53538da6c3c48723f910d1570dff19e8ec72cef09facb853f4b3ae14`.

Somente estrutura e regras foram usadas. Os arquivos anexos e as linhas de pessoas não integram o repositório.
