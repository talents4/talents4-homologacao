# Referências de UI/UX — pesquisa documentada

Pesquisa real feita nesta sessão (busca na web, resultados datados de 2026). Nenhum código, imagem, marca ou layout proprietário foi copiado — só padrões de interação e organização de informação, adaptados à identidade e às regras de negócio do Talents 4. Cada linha abaixo cita a fonte real consultada.

## Atlassian Design System

- **URL:** [atlassian.design/components/dynamic-table](https://atlassian.design/components/dynamic-table), [atlassian.design/components](https://atlassian.design/components)
- **Padrão observado:** "dynamic table" com paginação, ordenação e reordenação embutidas; "table tree" para hierarquias aninhadas; cabeçalho de página combinando breadcrumb, botões, busca e filtros num só componente.
- **Problema que resolve:** dar uma âncora visual única (o cabeçalho da página) para "onde estou / o que posso fazer aqui", em vez de espalhar busca e filtros soltos pela tela.
- **Aplicabilidade ao Talents 4:** a tabela já implementada (`t4-v2-ui.js`, `table()`) já tem ordenação, paginação, colunas ocultáveis e densidade — falta um cabeçalho de página consistente que combine breadcrumb (novo) + contador de resultado + ações.
- **Decisão:** **Adaptar.** Adicionar um breadcrumb leve (contexto: Área → Visão → Filtro ativo) acima do título de cada tela, reaproveitando a tabela já existente.
- **Justificativa:** a tabela já é boa; o problema real (confirmado na auditoria anterior desta conversa) é o usuário não saber sempre "onde está" — breadcrumb resolve isso sem reescrever nada que já funciona.

## Salesforce Lightning Design System (SLDS)

- **URL:** [lightningdesignsystem.com — Display Density](https://www.lightningdesignsystem.com/2e1ef8501/p/805bbe-display-density), [developer.salesforce.com — lightning-datatable](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-datatable.html)
- **Padrão observado:** densidade de exibição (compact/comfortable) controlada por um único parâmetro `density`, aplicado tanto a formulários quanto a tabelas, com um "Density Settings" administrável.
- **Problema que resolve:** operadores que usam o sistema o dia inteiro preferem visão compacta; quem está aprendendo prefere visão confortável — uma densidade fixa erra para um dos dois grupos.
- **Aplicabilidade:** o Talents 4 **já tem** esse toggle na tabela (`t4-grid-tools`, botão "Compacto/Confortável", visto na auditoria anterior). O que falta é persistir a escolha entre sessões e aplicá-la a mais telas (hoje só a tabela tem o toggle; cartões/lista não).
- **Decisão:** **Adotar (parcial).** Persistir a densidade escolhida em `localStorage`, e propagar a mesma preferência para a visão em Lista.
- **Justificativa:** reaproveita um componente já testado; baixo risco, ganho real de conforto no uso prolongado, que é um requisito explícito do produto.

## Linear

- **URL:** [gunpowderlabs.com — Linear's Delightful Design Patterns](https://gunpowderlabs.com/2024/12/22/linear-delightful-patterns), [uxpatterns.dev/patterns/advanced/command-palette](https://uxpatterns.dev/patterns/advanced/command-palette)
- **Padrão observado:** paleta de comandos (`Cmd/Ctrl+K`) como superfície central de navegação e ação — digitar "invite" mostra o comando com o atalho ao lado, ensinando o atalho pelo uso; modo 100% teclado.
- **Problema que resolve:** operador experiente não quer navegar clicando; a paleta de comandos é mais rápida que qualquer menu.
- **Aplicabilidade:** o Talents 4 **já tem** uma paleta de comandos (`t4-v2-core.js`, `openCommandPalette()`, atalho `Cmd/Ctrl+K`) — mas hoje ela só lista navegação e a ação primária da tela, não ações operacionais (ex.: "Nova seleção", "Filtrar por Alemão B1").
- **Decisão:** **Adaptar.** Expandir o conteúdo da paleta para incluir ações contextuais da tela atual (não só navegação), matching por texto.
- **Justificativa:** o componente já existe e já está testado (`check-v2.mjs` confirma `data-command`/atalho); expandir o conteúdo é baixo risco.

## Material Design 3

- **URL:** [m3.material.io/foundations/design-tokens/overview](https://m3.material.io/foundations/design-tokens/overview)
- **Padrão observado:** hierarquia de tokens em 3 camadas — *reference* (paleta bruta) → *system* (papel semântico: `primary`, `on-surface`, `error`) → *component* (valor específico de um componente). Tokens de densidade separados dos tokens de cor.
- **Problema que resolve:** mudar a cor de marca sem caçar valores hardcoded espalhados; um componente herda do token semântico, não do valor bruto.
- **Aplicabilidade:** é exatamente o problema que a auditoria anterior desta conversa encontrou nas 4 camadas de CSS do Talents 4 (`t4-v2.css`→`t4-modern.css`→`t4-v24.css`→`t4-v25.css`): 3 declarações conflitantes de `.t4-brand-logo` na mesma cascata porque não havia uma camada de token única.
- **Decisão:** **Adotar a estrutura de 3 camadas**, sem adotar o Material visualmente (o Talents 4 não deve parecer um app Material — a identidade já é outra). Ver `docs/design/DESIGN_SYSTEM.md`.
- **Justificativa:** resolve diretamente um bug real já documentado, com uma estrutura testada e amplamente adotada — não é modismo, é o padrão correto para o problema que já existe no código.

## Apple Human Interface Guidelines

- **URL:** [developer.apple.com/design/human-interface-guidelines/sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)
- **Padrão observado:** sidebar como superfície primária de navegação em apps de macOS, recolhível, com estado persistido; **não** usar tab bar de iOS em app de desktop.
- **Problema que resolve:** manter navegação persistente e previsível sem gastar largura de tela permanentemente.
- **Aplicabilidade:** o Talents 4 já usa sidebar persistente (correto, já segue esta diretriz), mas **não é recolhível** — em telas menores (1280×720, tablet) ela ocupa espaço fixo o tempo todo.
- **Decisão:** **Adotar.** Sidebar recolhível com estado persistido em `localStorage`, seguindo a HIG (botão de colapsar na barra superior + atalho de teclado).
- **Justificativa:** ganho direto de área útil em telas menores, sem mudar a navegação em telas grandes (o padrão recomenda exatamente isso, não esconder a sidebar por padrão).

## Ashby (ATS)

- **URL:** [ashbyhq.com/product-updates/job-specific-candidate-pipelines](https://www.ashbyhq.com/product-updates/job-specific-candidate-pipelines), [dover.com — Ashby review](https://www.dover.com/blog/ashby-ats-review-pricing-alternatives)
- **Padrão observado:** "single pane of glass" — pipeline visual com o próximo passo pendente visível por candidato, sem precisar abrir cada ficha.
- **Problema que resolve:** recrutador que gerencia dezenas de candidatos não quer abrir ficha por ficha para saber "o que falta fazer".
- **Aplicabilidade:** o Talents 4 **já implementa isso** — a coluna "Próximo passo" na lista de Talentos (corrigida nesta mesma conversa, ver correção do bug `next_action_due`→`next_action_at`) é exatamente esse padrão.
- **Decisão:** **Já adotado — reforçar.** Deixar a coluna "Próximo passo" mais proeminente visualmente (hoje é texto simples; dar peso visual equivalente ao de um ATS profissional).
- **Justificativa:** confirma que a decisão de produto já tomada está alinhada com a categoria de produto (ATS/CRM de recrutamento), não precisa reinventar.

## Airtable

- **URL:** [community.airtable.com — saving filter settings](https://community.airtable.com/interface-designer-12/saving-filter-settings-in-airtable-interface-38855), [eleken.co — filter UX patterns](https://www.eleken.co/blog-posts/filter-ux-and-ui-for-saas)
- **Padrão observado:** filtrar não apaga registro, só oculta da visão; "sempre indicar quando um filtro está ativo, mesmo escondido"; filtros frequentes sempre visíveis, os raros atrás de "Mais filtros".
- **Problema que resolve:** usuário se assusta achando que um registro "sumiu" quando na verdade só foi filtrado.
- **Aplicabilidade:** o Talents 4 já tem esse modelo mental correto no código (`filtered()` nunca exclui dados, só a visão) — mas a UI não deixa claro OS FILTROS ATIVOS de forma agregada quando há vários simultâneos.
- **Decisão:** **Adotar.** Uma barra de "filtros ativos" (chips removíveis individualmente) sempre visível quando há 1+ filtro aplicado, com contagem de resultados ao lado.
- **Justificativa:** o multi-filtro (`t4-multi-filter`) já mostra a contagem de selecionados dentro do próprio dropdown; falta agregar isso numa barra visível sem precisar abrir cada filtro.

## Notion

- **URL:** [notion.com/help/views-filters-and-sorts](https://www.notion.com/help/views-filters-and-sorts)
- **Padrão observado:** cada "view" salva sua própria combinação de layout + filtro + ordenação + agrupamento; trocar de view muda tudo de uma vez.
- **Problema que resolve:** o mesmo conjunto de dados serve fluxos de trabalho diferentes ("minha fila hoje" vs. "tudo por empregador") sem recriar o filtro toda vez.
- **Aplicabilidade:** o Talents 4 tem filtros rápidos (`quickFilters`) mas não permite salvar uma COMBINAÇÃO personalizada de filtros como uma view nomeada.
- **Decisão:** **Adotar, com escopo local (sem tabela nova no Supabase).** "Visualizações salvas" armazenadas em `localStorage` por usuário — não é dado de negócio, não precisa de schema novo, resolve o pedido sem risco de migração.
- **Justificativa:** atende ao requisito de "visualizações salvas" sem tocar no Supabase (mantém "custo zero" e "risco de migração" baixo, como pedido).

## Microsoft Fluent 2

- **URL:** [fluent2.microsoft.design/accessibility](https://fluent2.microsoft.design/accessibility)
- **Padrão observado:** conteúdo precisa refluir sem rolagem horizontal até zoom de 400% (breakpoint de referência: 320px); alvos de toque de pelo menos 44×44px.
- **Problema que resolve:** usuários com baixa visão ou em dispositivos pequenos não podem operar o sistema.
- **Aplicabilidade:** requisito direto de acessibilidade WCAG 2.2 AA já pedido nesta tarefa.
- **Decisão:** **Adotar como critério de aceitação.** Ver `docs/design/CRITERIOS_ACEITACAO.md`.
- **Justificativa:** é um critério objetivo e testável (zoom 400%, alvo de toque), não uma preferência estética.

## O que foi pesquisado mas rejeitado

- **Salesforce Lightning (aparência visual completa) e Material Design (aparência visual completa):** rejeitados como identidade visual — o Talents 4 já tem marca própria (navy/vermelho/laranja/amarelo/roxo/creme) e a tarefa pede explicitamente para não parecer "landing page" nem copiar sistemas de terceiros. Só os padrões estruturais (tokens, densidade) foram adotados, não a pele visual.
- **HubSpot, Greenhouse, Lever:** buscados, mas sem documentação pública de padrões (ao contrário de sistemas de design abertos como Atlassian/Salesforce/Material), então não há fonte citável específica — não incluídos para evitar inventar uma referência que não foi de fato consultada.
