# Talents 4 V2.5 · produto e arquitetura

## Objetivo

A V2.5 é a camada operacional de homologação do Talents 4. A prioridade é reduzir decisões ambíguas no trabalho diário sem reescrever a base funcional nem misturar homologação com produção.

## Princípios de produto

1. **Uma ficha por Talento.** Cadastro, acompanhamento, aulas, agenda e histórico apontam para a mesma pessoa.
2. **Etapa não é recomendação.** A etapa do processo, a oportunidade e a classificação NectaNet são conceitos separados.
3. **Atenção vira fila de trabalho.** Pendência, prioridade e prazo produzem um próximo passo legível; não criam uma etapa artificial.
4. **Automação apoia, não decide apresentação.** Score, idioma projetado e radar ajudam a revisar, mas a liberação para empresa continua manual.
5. **Supabase permanece fonte transacional.** A homologação não cria um banco novo e não executa migração automaticamente.

## Experiência implementada

- shell compartilhado com busca `/`, ações `Ctrl/Cmd + K`, navegação por teclado, responsividade e menu lateral com rolagem independente;
- filtros rápidos e filtros múltiplos que preservam o contexto durante a seleção;
- visualizações em cartões, lista e tabela completa;
- seleção em massa com recorte visível, contador, limpeza e exportação contextual;
- Centro de dados com prévia, confirmação, mensagens de progresso e tratamento de abas desconhecidas;
- exportação local usando os modelos oficiais, com abas por Talento, congelamento de cabeçalho, autofiltro e quebras de página;
- estado de dados complementares compacto, sem transformar ausência opcional em erro alarmista;
- logo menor e hierarquia visual mais confortável para uso prolongado.

## Importação e normalização

Os dois modelos são lidos localmente no navegador. O importador reconhece:

- `Candidatos priorizados`, preservando 18 colunas;
- `Nectanet Partner`, preservando 13 colunas;
- `Empresas detalhadas`, preservando 5 colunas;
- abas individuais de Talento, com contexto e 16 colunas de acompanhamento;
- `Resumo BW` e `Radar NectaNet`, usados para preservar contexto, barreiras, prioridades, avaliações e alvos humanos já registrados.

O processo faz upsert idempotente por identificação estável ou correspondência de nome. Campos não suportados por uma coluna antiga do banco são retirados apenas após uma resposta explícita de coluna ausente; não são substituídos silenciosamente por zero. Fórmulas do Excel são tratadas como valores exibidos e macros não são executados.

## Segurança e limites

O front-end usa a chave pública `anon` do Supabase, respeita RLS e não recebe segredo administrativo. O Centro de dados não usa Drive, Google Planilhas, OAuth, armazenamento persistente local ou sincronização automática. A projeção B1 deve ser lida como cenário de idioma e não como decisão de contratação.

## Próximas evoluções recomendadas

- histórico de importações com usuário, data, arquivos e contagens;
- validação de duplicidade por e-mail e nome antes da confirmação;
- atividades de follow-up sugeridas pela fila de atenção, sempre com confirmação humana;
- testes de contrato com uma amostra anonimizada de cada modelo oficial.
