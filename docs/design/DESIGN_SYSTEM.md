# Design System — Talents 4

Fonte única: [`assets/t4-tokens.css`](../../assets/t4-tokens.css), carregado antes de qualquer outra folha de estilo em todas as 8 páginas (verificado por `scripts/check-v2.mjs`). Este documento explica o que já existe e como usar — os valores reais estão no CSS, não duplicados aqui (evita os dois ficarem dessincronizados).

## Por que isto existe

A auditoria desta mesma conversa encontrou **3 declarações conflitantes** do tamanho do logo, espalhadas em `t4-v25.css` por 3 "eras" de redesenho diferentes (V2.4 → V2.5 → "V2.6 acabamento de produto"), cada uma sobrescrevendo a anterior sem removê-la. Isso não é um caso isolado — é o sintoma de não ter uma camada de token única. `t4-tokens.css` é essa camada.

## Estrutura em 3 camadas (ver justificativa em `REFERENCIAS_UIUX.md`, seção Material Design 3)

1. **Referência** (`--t4-color-*`): a paleta bruta da marca (navy, vermelho, coral, laranja, amarelo, roxo). Nunca usada direto num componente.
2. **Semântica** (`--t4-ink`, `--t4-surface`, `--t4-critical`, `--t4-success`...): o papel que a cor exerce. **É isto que um componente deve consumir.**
3. **Componente**: valores que só fazem sentido num lugar (ex.: `--employer-color` calculado por empresa em `organization-v2.js`) continuam definidos localmente, não migram para cá.

## Cores semânticas

| Token | Uso |
|---|---|
| `--t4-bg` / `--t4-surface` / `--t4-surface-sunken` | Fundo da página / cartões e painéis / áreas rebaixadas (ex. corpo de tabela) |
| `--t4-ink` / `--t4-ink-soft` / `--t4-ink-faint` | Texto primário / secundário / desabilitado ou legenda |
| `--t4-line` / `--t4-line-strong` | Borda padrão / borda com mais ênfase (ex. campo em foco) |
| `--t4-accent` / `--t4-accent-soft` | Cor de marca para ação primária / fundo suave para estado selecionado |
| `--t4-success` / `--t4-warning` / `--t4-critical` / `--t4-info` (+ `-soft`) | Estados semânticos — **separados da cor de marca**, nunca reaproveitar `--t4-accent` para "sucesso" |

Regra: cor sozinha nunca é o único indicador de estado (WCAG 1.4.1) — todo estado semântico tem um rótulo de texto ou ícone ao lado, não só a cor de fundo.

## Tipografia

Stack de sistema (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, sans-serif`) — decisão já correta no código, mantida. Escala de 8 degraus, de `--t4-text-eyebrow` (9px, rótulos em caixa alta) a `--t4-text-display` (21px, títulos de página). Texto corrido usa `--t4-line-height: 1.5`.

## Espaçamento, raio, elevação

- Espaçamento em escala de 4px (`--t4-space-1` a `--t4-space-10`) — o incremento já dominante no CSS existente, agora nomeado.
- Raio: `sm` (7px, controles pequenos) · `md` (11px, cartões/campos) · `lg` (16px, painéis) · `pill` (999px, badges/chips).
- Elevação em 3 níveis (`--t4-shadow-1/2/3`) — sombra sutil e funcional (indica o que é clicável/flutuante), nunca decorativa. **Isto é uma regra de produto explícita:** nada de "sombras pesadas" ou "excesso de elementos flutuantes" (ver `docs/design/CRITERIOS_ACEITACAO.md`).

## Motion

`--t4-duration-fast` (120ms) para microinterações (hover, foco), `--t4-duration-base` (180ms) para abertura de painel/drawer. **Toda animação respeita `prefers-reduced-motion`** — já garantido no CSS existente (`@media (prefers-reduced-motion: reduce)`, confirmado na auditoria anterior) e mantido nos componentes novos.

## Z-index nomeado

`--t4-z-dropdown` (60) < `--t4-z-sidebar` (70) < `--t4-z-overlay` (80) < `--t4-z-modal` (90) < `--t4-z-toast` (100). Evita a prática de "colocar 9999 para garantir" — cada novo componente escolhe a camada certa, não um número arbitrário maior que os outros.

## Foco

`--t4-focus`: anel de foco único (`box-shadow` com `color-mix`), reaproveitável por qualquer componente novo. Todo controle interativo precisa de foco visível — sem exceção, mesmo em componentes customizados (checkbox, toggle, chip).

## Breakpoints

Não são custom properties (CSS não permite `@media (max-width: var(...))`) — documentados aqui para consistência: `680px` (mobile) e `1000px` (tablet/notebook pequeno), os mesmos já usados em `t4-v2.css`/`t4-v25.css`. Novos componentes devem usar exatamente esses dois valores, não inventar um terceiro breakpoint.

## Temas

`:root[data-theme="dark"]` já define os tokens semânticos para tema escuro em `t4-tokens.css`, **mas o tema escuro não está ativado nesta entrega.** Os componentes existentes (mais de 3.000 linhas de CSS em 4 arquivos) não foram auditados individualmente para contraste em fundo escuro — ativar sem essa auditoria arriscaria texto ilegível em produção, o tipo de regressão que este próprio redesign existe para evitar. Os tokens estão prontos para quando essa auditoria for feita.

## Como um componente novo deve ser escrito

```css
/* Correto: consome token semântico */
.novo-componente { background: var(--t4-surface); color: var(--t4-ink); border-radius: var(--t4-radius-md); box-shadow: var(--t4-shadow-1); }

/* Incorreto: valor isolado, não rastreável, não atualiza se a marca mudar */
.novo-componente { background: #fff; color: #1b2a3e; border-radius: 11px; box-shadow: 0 2px 8px rgba(0,42,74,.06); }
```

## O que não foi migrado nesta entrega (decisão registrada, não esquecimento)

As três folhas de estilo existentes (`t4-v2.css`, `t4-v24.css`, `t4-v25.css`) **continuam com seus próprios valores locais** (`--t4-navy`, `--v25-ink`, etc.) — não foram reescritas para consumir só os tokens novos. Migrar ~3.000 linhas de CSS já testado visualmente é um trabalho de alto risco e baixo retorno imediato (nenhum bug visível é causado por isso hoje, exceto o do logo, já corrigido). A convenção a partir de agora é: **todo componente novo usa `t4-tokens.css`; componentes existentes migram quando forem tocados por outro motivo**, não como um projeto à parte.
