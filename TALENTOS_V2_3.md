# Talentos V2.3 — fluxo claro

Esta revisão é uma camada isolada sobre o CRM V2.2. A ficha do Talento continua única, e as informações legadas continuam consultáveis.

## Decisões de produto

- **Talentos:** cadastro e busca da pessoa.
- **Acompanhamento:** relações pessoa–empresa–vaga, avaliações, riscos, fonte e próxima ação.
- **Apresentações:** somente quem tem liberação humana explícita.
- **Mercado:** oportunidades e Radar NectaNet; não é uma etapa do Talento.
- **Agenda integrada:** ações provenientes da operação, seleções, contatos e Alemão.

Filtros múltiplos usam OU dentro de cada grupo e E entre grupos. A cor do empregador é um identificador visual, nunca uma aprovação.

## Limites

A prévia usa dados fictícios e não grava. A atualização incremental só deve ser aplicada na homologação após backup/verificação. Não há Google Planilhas, sincronização com Drive, SQL automático ou criação automática de Talentos nesta entrega.
