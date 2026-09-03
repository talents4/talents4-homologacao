# Decisão arquitetural — frontend do Talents 4

## Decisão

**Manter HTML/CSS/JavaScript puro, sem build step, sem framework.** Consolidar o design system existente (hoje distribuído implicitamente em 4 camadas de CSS) em tokens formais. Investir o esforço do redesign em telas, componentes e conteúdo, não em reescrever a fundação.

## Como a decisão foi tomada

Avaliada cada opção da lista fornecida contra os critérios pedidos (estabilidade, custo zero, licença permissiva, acessibilidade, manutenção, desempenho, compatibilidade com Supabase, facilidade de evolução, risco de migração):

| Opção | Estabilidade | Risco de migração | Ganho real hoje | Decisão |
|---|---|---|---|---|
| **Vite + build step** | Alta (ferramenta madura) | **Alto** — o site é publicado direto pelo GitHub Pages a partir do branch, sem CI/CD (confirmado na auditoria: não há `.github/workflows`); introduzir um build quebra esse fluxo até alguém configurar um pipeline novo | Nenhum ganho funcional imediato — o app já carrega rápido sem bundler (7 arquivos JS pequenos, sem framework) | **Rejeitado por ora.** Documentado como opção futura de baixo risco (Vite não obriga framework; só empacota o que já existe) |
| **React / Vue** | Alta como tecnologia, **baixa para este projeto específico** | **Muito alto** — reescreveria ~7.000 linhas de JS já testadas (106 testes unitários + 380 checagens estáticas, confirmados nesta mesma sessão), incluindo toda a camada de segurança (escaping, CSP, RLS) e o módulo de mapeamento recém-construído | Nenhum problema atual é causado por "falta de framework" — os problemas reais encontrados (logo grande, texto técnico, bug de fórmula) são de conteúdo/CSS/lógica pontual, não de arquitetura | **Rejeitado.** Ver seção "Por que não" abaixo |
| **TypeScript** | Alta | **Baixo**, se feito via JSDoc + `checkJs` (sem exigir build) | Ganho real de segurança de tipo, mas exige tooling novo (tsc) rodando em CI que hoje não existe | **Adiado**, recomendado como próximo passo de baixo risco (ver "Trabalho futuro") |
| **Componentes reutilizáveis** | — | Baixo | Já existem de fato (`t4-v2-ui.js`: `table()`, `form()`, `multiFilter()`, `toast()`, `openModal()`, `openDrawer()`, paleta de comandos) | **Adotado — formalizar, não recriar** |
| **Sistema de tokens** | — | Baixo | Resolve um bug real já documentado (3 declarações conflitantes do tamanho do logo) | **Adotado** — ver `DESIGN_SYSTEM.md` |
| **Estado centralizado (Redux/Zustand/etc.)** | Alta como tecnologia | Médio | Cada tela já usa um objeto `state` local simples, sem duplicação de fonte de verdade entre telas (confirmado lendo `talents-v2.js`, `organization-v2.js`) — não há o problema que essas bibliotecas resolvem | **Rejeitado.** Não há sintoma a tratar |
| **Roteamento (client-side router)** | — | Baixo/médio | O app já usa `?view=` na URL com `history.pushState`, deep-linkable, com botão voltar funcional (`t4-v2-core.js`, `route()`) | **Rejeitado — já resolvido** |
| **Testes visuais / Playwright** | Alta | Baixo tecnicamente, mas **introduziria a primeira dependência npm do projeto** (hoje zero `node_modules`) | Real, mas o navegador do Claude Code já permite verificação visual manual nesta sessão | **Adiado, recomendado.** Ver `CRITERIOS_ACEITACAO.md` |
| **Biblioteca de tabelas (ex.: AG Grid, TanStack Table)** | Alta | Médio (nova dependência, CSP a ajustar) | A tabela atual já tem ordenação, paginação, densidade, colunas ocultáveis — falta só fixar/redimensionar coluna, que é incremento pequeno | **Rejeitado.** Estender o componente existente é mais barato e mais seguro que trocar |
| **Biblioteca de gráficos** | — | Baixo/médio | Não há tela de dashboard com gráfico hoje; avaliar quando a funcionalidade for definida | **Adiado** até haver um caso de uso concreto |
| **Supabase Realtime** | Já em uso | — | O app **já usa** `client.channel(...).on('postgres_changes', ...)` (`t4-v2-data.js`, `subscribe()`) — Realtime já está ligado | **Já adotado**, sem mudança necessária |
| **Web Workers** | Alta | Baixo | Único processamento pesado é o parser de planilha (`t4-workbook.js`), que já roda de forma assíncrona sem travar a UI perceptivelmente para os tamanhos reais medidos (136 e 145 linhas) | **Rejeitado por ora** — sem sintoma de lentidão a corrigir |
| **PWA** | Alta | Baixo | Sem benefício claro pedido pelo produto (uso é sempre online, é um CRM interno) | **Rejeitado** — nenhum requisito o justifica |

## Por que não migrar para um framework

Evidência concreta, não preferência:

1. **O que já existe funciona e está testado.** Nesta mesma conversa, o código atual passou por uma auditoria completa (achados P0–P3, todos com evidência de arquivo:linha), teve bugs reais corrigidos (logo quebrado, campo de data trocado, leitor de Excel), e ganhou um módulo novo inteiro (classificação de empresas, staging de importação) — tudo com **106 testes unitários e 380 checagens estáticas passando**. Reescrever em React descartaria essa base de evidência e reintroduziria risco em código já estabilizado.
2. **A CSP do projeto já é rígida por design** (`script-src 'self' https://cdn.jsdelivr.net`, sem `'unsafe-inline'` nem `'unsafe-eval'`) — compatível com framework, mas qualquer framework precisaria ser servido do mesmo CDN já permitido ou embutido, e teria que provar que não introduz nenhum vetor novo de XSS num sistema que hoje tem escaping consistente auditado manualmente.
3. **Não há CI/CD.** O deploy é: commitar em `main` → GitHub Pages serve os arquivos como estão. Introduzir um build step sem configurar um pipeline de CI quebraria o deploy até alguém fizer esse trabalho — que não está no escopo desta tarefa.
4. **Nenhum problema relatado é causado pela ausência de framework.** Todos os bugs reais encontrados nesta e nas sessões anteriores desta conversa (logo, texto técnico, campo de data, leitor de planilha) são bugs de CSS/conteúdo/lógica pontual — o tipo de bug que acontece igual em qualquer stack.

## O que muda de fato nesta entrega

- **Um arquivo de tokens novo** (`assets/t4-tokens.css`), carregado antes de tudo, formalizando cor semântica, tipografia, espaçamento, raio, elevação, motion, z-index, breakpoints — sem remover as 4 camadas existentes (risco desnecessário), só adicionando a camada de referência que faltava.
- **Componentes novos onde havia lacuna real** (tooltip, breadcrumb, barra de filtros ativos, badges de classificação de empresa) — usando os mesmos padrões (`esc()`/`attr()`, CSS puro, sem dependência nova).
- **Nenhuma tabela, formulário ou fluxo de dado reescrito do zero.**

## Trabalho futuro recomendado (não feito nesta entrega, com justificativa)

1. **TypeScript via JSDoc** (`// @ts-check` + `tsc --noEmit` num script de verificação, sem build): ganho de segurança de tipo com risco quase zero, mas exige decidir se o CI (ainda inexistente) vai rodar essa checagem — decisão de processo, não só de código.
2. **Playwright para testes visuais**: seria a primeira dependência npm do projeto. Recomendado, mas a decisão de "aceitar a primeira dependência" merece aprovação explícita de quem mantém o repositório, não uma decisão unilateral tomada durante um redesign.
3. **Vite como empacotador (não como motivo para adotar framework)**: útil se o projeto crescer a ponto de o número de arquivos `<script>` carregados (hoje 19 no maior caso, `index.html`) começar a pesar no tempo de carregamento — hoje ainda não pesa o suficiente para justificar o risco de mudar o pipeline de publicação.
