# Critérios de aceitação — redesign UI/UX

Checklist de gate para esta entrega e para qualquer mudança futura de UI. Uma tela/PR não pode ser chamada de "pronta" se qualquer item abaixo falhar — isto não é um guia de estilo opcional, é o critério explícito do pedido original para declarar o trabalho concluído.

## Bloqueadores de aceitação (qualquer um destes impede declarar "concluído")

- [ ] `node scripts/check-v2.mjs` termina em `N/N verificações estáticas aprovadas` (401/401 no fechamento desta entrega)
- [ ] `node --test tests/**/*.test.mjs` sem falhas (111/111 no fechamento desta entrega)
- [ ] Zero erro no console do navegador ao navegar pelas 4 páginas em modo demonstração (`demo/*.html`) — verificado via `mcp__Claude_Browser__read_console_messages` nesta entrega
- [ ] Nenhum layout quebrado nos breakpoints de referência (ver `ARQUITETURA_FRONTEND.md` e checagens visuais desta entrega: 1440×900, 375×812 mobile)
- [ ] Nenhum texto técnico (SQL, stack trace, `Failed to fetch`, JSON bruto fora de uma seção de auditoria explicitamente rotulada) visível fora de um `<details>` rotulado como histórico/origem
- [ ] Seleção de linhas de tabela não é perdida por filtro, ordenação ou paginação (comportamento pré-existente, reverificado nesta entrega)
- [ ] Exportação de planilha continua fiel aos modelos oficiais (`Mapeamento candidatos - Nectanet.xlsm`, `Mapeamento Talents 4 2026.08.31.xlsx`) — não alterado nesta entrega, não regredido
- [ ] Nenhuma chamada ao Supabase referencia campo inexistente (coberto por `scripts/check-v2.mjs`, seção de contrato de dados)
- [ ] Nenhuma funcionalidade nova altera uma regra de negócio fixa (lista abaixo) automaticamente

## Regras de negócio fixas (nunca automatizar, nunca inferir)

Repetidas aqui porque são o critério mais fácil de violar sem perceber ao adicionar uma funcionalidade "inteligente":

1. "Pronto para apresentar" depende de decisão humana explícita — nunca calculado.
2. NectaNet é classificação de origem, não etapa de funil, e nunca libera apresentação sozinha.
3. Score nunca substitui decisão humana.
4. Etapa de seleção nunca muda automaticamente por idioma, aderência ou qualquer sinal calculado.
5. Campo não visível na tela não pode ser apagado numa edição parcial.
6. Nenhum dado fictício é criado para preencher uma tela vazia — vazio mostra estado vazio explicado, nunca dado inventado.
7. "Parceira Talents 4" só aparece com `direct_talents4_partnership === 'CONFIRMADA'` no banco — nunca inferida de "Nectanet MATCH" ou de qualquer sinal indireto (coberto por `tests/employer-classification.test.mjs`).

## Excessos visuais proibidos (pedido original, verificado nesta entrega)

- Transparência excessiva / "Liquid Glass" exagerado — `t4-tokens.css` não define nenhum blur/glassmorphism; superfícies são opacas (`--t4-surface: #ffffff`)
- Baixo contraste — cores semânticas (`--t4-ink`, `--t4-critical`, etc.) escolhidas para contraste AA, sem token "decorativo" de baixo contraste
- Sombras pesadas — 3 níveis de elevação nomeados (`--t4-shadow-1/2/3`), progressão sutil, nunca usada de forma decorativa (ver `DESIGN_SYSTEM.md`)
- Animação decorativa — `--t4-duration-fast`/`--t4-duration-base` (120–180ms) só em microinteração com propósito (abrir painel, indicar seleção); `prefers-reduced-motion` respeitado em 100% dos componentes, incluindo os novos desta entrega (chip de filtro, ícone de recolher menu)
- Elementos flutuantes em excesso — nenhum componente novo desta entrega usa `position: fixed`/`sticky` decorativo; a barra de filtros ativos nasce no fluxo normal do documento, não flutua sobre o conteúdo
- Aparência de landing page — sem hero decorativo novo em nenhuma tela operacional (o único "hero" visual do produto é o mockup separado entregue como artifact, fora do app real — ver relatório da fase anterior)

## Acessibilidade (WCAG 2.2 AA onde aplicável)

- [ ] Todo controle novo tem `aria-label` quando o texto visível não é suficiente sozinho (ex.: ícone de recolher menu, botão `×` de cada chip de filtro — inclui o valor removido no próprio rótulo, não só "remover filtro")
- [ ] Todo controle novo é alcançável e operável por teclado (recolher menu, remover chip, abrir dropdown de filtro — todos são `<button>`/`<details>` nativos, não `<div onclick>`)
- [ ] Foco visível em todo controle interativo novo, herdado de `--t4-focus` (`DESIGN_SYSTEM.md`)
- [ ] Nenhuma informação de estado depende só de cor — badges de classificação e situação sempre têm texto, nunca só uma bolinha colorida
- [ ] Recolher o menu lateral não remove nome/rótulo do leitor de tela — texto fica no DOM via `aria-label` no botão, só a exibição visual do texto some (ver `t4-v25.css`, `.t4-sidebar-collapsed`)

## Terminologia (verificado nesta entrega)

Interface usa exclusivamente "Talento(s)" — nunca "candidato(s)". Verificação: `assets/t4-v2-core.js` função `term()` já normaliza qualquer resíduo de "candidato" vindo de dado legado; nenhuma string nova desta entrega introduz o termo proibido (conferido por leitura de todo texto adicionado).

## Como usar este documento

Antes de declarar qualquer entrega de UI "concluída" — não só esta — rodar a lista de bloqueadores primeiro. Se qualquer item falhar, a entrega correta é **"parcial"** com o item listado como pendência explícita, não "concluída com ressalva".
