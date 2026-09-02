# Talents 4 · homologação

Este repositório contém a versão de validação do CRM Talents 4. Ele é separado da operação principal e serve para conferir experiência, dados, importação e exportação antes de qualquer decisão de publicação.

## Abrir no navegador

Use a página publicada da homologação:

**https://talents4.github.io/talents4-homologacao/**

Não é necessário instalar VS Code, Node, npm ou rodar servidor local. A demonstração sem banco fica em `demo/`.

## O que esta versão entrega

- base única de Talentos, com busca, filtros combináveis, fila de atenção e próximo passo;
- seleção em massa, sem alterar etapa ou liberar apresentação;
- Centro de dados para ler os dois modelos oficiais (`.xlsx` e `.xlsm`) no navegador;
- prévia antes da gravação no Supabase, com contagem de abas e linhas reconhecidas;
- exportação dos dois modelos com os mesmos campos, abas, contexto, resumos, radar e quebra por Talento;
- visual responsivo com logo dimensionado, menu lateral rolável, foco de teclado e estados de erro compreensíveis;
- fila de Apresentações preservando a regra de liberação manual.

## Fluxo oficial

1. Abra a URL acima e entre com seu usuário.
2. Entre em **Talentos → Centro de dados**.
3. Escolha os dois arquivos oficiais e confira a prévia.
4. Confirme a importação somente se os números e os nomes fizerem sentido.
5. Volte para **Talentos**, marque as pessoas desejadas e abra **Exportar seleção**.
6. Baixe **NectaNet**, **Acompanhamento** ou os dois arquivos.

O sistema não sincroniza Drive, Google Planilhas ou produção. Não executa SQL pelo front-end. A projeção B1 é apenas cenário de idioma; não aprova um Talento e não dispara apresentação.

Para o roteiro detalhado, consulte [PASSO_A_PASSO.md](PASSO_A_PASSO.md) e [PASSO_A_PASSO_TALENTOS_V2_5.md](PASSO_A_PASSO_TALENTOS_V2_5.md).
