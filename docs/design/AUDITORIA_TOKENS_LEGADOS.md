# Auditoria de tokens legados

Produzida como Preparação 2 da Etapa 2A do redesign visual 2026, antes de
qualquer edição de tipografia (branch `claude/talents4-crm-audit-usm3v6`).
Versionada aqui porque os achados continuam valendo para qualquer etapa
futura que toque `t4-v2.css`, `t4-v24.css`, `t4-v25.css` ou `t4-modern.css`
— não é um artefato descartável de uma única etapa.

Objetivo: registrar duplicidades semânticas entre custom properties locais
(`--v24-*`, `--v25-*`, `--t4-*` de t4-v2.css, `--mx-*`) e os tokens novos
(`--t4-*` de t4-tokens.css, ver [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)),
**sem migrar tudo de uma vez**. Preferir o token `--t4-*` novo só quando um
componente for tocado e a equivalência abaixo já estiver comprovada. Todos
os valores abaixo foram confirmados por leitura de fonte E, onde havia
ambiguidade de cascata, por `getComputedStyle()` num browser real — não por
suposição de ordem de arquivo.

## 1. Duplicata de NOME (mais grave — não é só valor parecido)

`t4-v2.css` já definia, no seu próprio `:root` (linhas 2-24), variáveis com
o **mesmo nome** que `t4-tokens.css` viria a usar depois. Como `t4-v2.css`
carrega DEPOIS de `t4-tokens.css`, a redeclaração de `t4-v2.css` é a que
vale hoje — a de `t4-tokens.css` já está sombreada para estes 5 nomes:

| Nome | t4-tokens.css (sombreado) | t4-v2.css (vence hoje) | Risco |
|---|---|---|---|
| `--t4-ink` | `#1b2a3e` | `#1b2a3e` | Valores iguais hoje — inofensivo, mas editar só em t4-tokens.css não terá efeito nenhum. |
| `--t4-line` | `#e2e8f0` | `#e2e8f0` | idem |
| `--t4-line-strong` | `#cbd5e1` | `#cbd5e1` | idem |
| `--t4-bg` | `#f4f7fb` | `#f4f7fb` | idem |
| `--t4-success` | `#097858` | `#097858` | idem |

Nenhum bug visível hoje (valores idênticos), mas a alegação de "fonte
única" do cabeçalho de t4-tokens.css não é literalmente verdadeira para
estes 5 nomes. Qualquer etapa futura que edite um destes precisa editar
**os dois arquivos** ou aceitar que a edição em t4-tokens.css é inerte.

## 2. Duplicata de VALOR, nome diferente (candidatos seguros para preferir `--t4-*` ao tocar o componente)

| Local (legado) | Valor | `--t4-*` equivalente | Valor |
|---|---|---|---|
| `--v25-ease` (t4-v25.css) | `cubic-bezier(.2,.8,.2,1)` | `--t4-ease` | idêntico (exemplo já dado) |
| `--t4-danger` (t4-v2.css) | `#b4233d` | `--t4-critical` | idêntico |
| `--t4-muted` (t4-v2.css) | `#64748b` | `--t4-ink-soft` | idêntico |
| `--mx-accent` (t4-modern.css) | `#002a4a` | `--t4-accent` | idêntico |
| `--v24-surface` (t4-v24.css) | `#ffffff` | `--t4-surface` | idêntico |
| `--v24-canvas` (t4-v24.css) | `#f4f7fb` | `--t4-bg` | idêntico |
| `--v24-radius` (t4-v24.css) | `16px` | `--t4-radius-lg` | idêntico |
| `--v25-surface-solid` (t4-v25.css) | `#ffffff` | `--t4-surface` | idêntico |

## 3. Achado direto para a Etapa 2A: `--t4-font-ui` está morto

`t4-tokens.css` define `--t4-font-ui` (stack com Inter por último), mas
**nenhuma regra no CSS consome essa variável** (grep confirma zero usos).
A família tipográfica que realmente renderiza no `body` — confirmado via
`getComputedStyle(document.body).fontFamily` em `demo/index.html` real —
vem da regra `body { font-family: ... }` de **t4-v25.css (linha 28-36)**,
que carrega por último e sobrescreve as regras equivalentes-porém-diferentes
de `t4-v2.css` (usa `--t4-font`, com Inter primeiro) e `t4-v24.css` (mesmo
stack hardcoded do v25, sem Inter). Resultado hoje: **nenhuma página usa
Inter** apesar de `--t4-font-ui` e `--t4-font` (t4-v2.css) mencionarem essa
fonte — o stack vencedor é só fontes de sistema
(`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
"Segoe UI", sans-serif`).

**Implicação prática**: se uma etapa futura precisar tocar font-family, o
arquivo a editar é `t4-v25.css` (não `t4-tokens.css`, não `t4-v2.css`) —
confirmado por computedStyle, não por leitura de ordem de carga. A Etapa
2A (Tipografia e Hierarquia Visual Global) deliberadamente não tocou
font-family — a regra "não imponha fonte nova" do briefing dessa etapa já
resolve a questão sem precisar ativar Inter.

## 4. Sombreamento DENTRO do próprio t4-v25.css (não só entre arquivos)

O arquivo tem três blocos `:root { }` incondicionais em sequência (linhas
6, 377, 509 — marcados nos comentários como "base", "V2.5.1" e "V2.5.2 ·
revisão visual real", sucessivas iterações de design deixadas no arquivo
em vez de substituídas). O último bloco (509) vence para tudo que ele
redefine. Confirmado por computedStyle: `--v25-ink` real é `#002a4a`
(idêntico a `--t4-accent`/`--t4-color-navy`), **não** `#17243a`, que é o
valor do primeiro bloco (linha 12) — fácil de ler errado sem checar o
computed style, exatamente o risco que a regra de verificação da Etapa 1B
existe para evitar. Mesma situação para `--v25-canvas`, `--v25-surface`,
`--v25-glass`, `--v25-blue`, `--v25-muted`, `--v25-line`, `--v25-shadow` —
os valores "certos" são sempre os do bloco 509, não os do bloco 6.

## 5. Parecidos mas DIFERENTES — não tratar como duplicata

| A | B | Por quê não são iguais |
|---|---|---|
| `--v24-ink` `#10243e` | `--t4-ink` `#1b2a3e` | hex diferente |
| `--mx-line` `#dce4eb` / `--v24-line` `#dce5ef` | `--t4-line` `#e2e8f0` | hex diferente (3 tons de cinza-azulado quase iguais, mas não idênticos) |
| `--t4-shadow` (t4-v2.css) `0 2px 8px #002a4a06, 0 8px 28px #002a4a04` | `--t4-shadow-2` `0 2px 8px rgba(0,42,74,.06), 0 8px 28px rgba(0,42,74,.04)` | armadilha sutil: alpha hex `06`/`04` = 2,4%/1,6%, não 6%/4% — mesma base de cor e offsets, opacidade real diferente |
| `--v25-blue` (bloco vencedor 509) `#0b63ce` | `--t4-info` `#1677ff` | hex diferente (achado inicial de "duplicata exata" estava errado — vinha do bloco :root sombreado, corrigido após checar o bloco 509) |

## 6. Inconsistência real, não é sobre nomear igual

Largura da sidebar tem **4 valores-base diferentes** espalhados pelas
camadas: `--t4-sidebar` (t4-v2.css) `248px` · `--v24-sidebar` `270px` ·
`--v25-sidebar` `252px` · `--t4-sidebar-width` (t4-tokens.css) `248px`.
Não são candidatos a "preferir o novo token" — cada era pode depender
dessa largura para o próprio markup/JS daquele componente. Registrado
apenas como fato, sem ação nesta preparação.

---

Nenhuma migração de cor/dimensão foi feita a partir desta auditoria em si.
Este registro serve de referência para quando um componente específico for
tocado numa etapa futura e a equivalência listada aqui puder ser comprovada
no contexto daquele componente. (Os tokens de escala tipográfica —
`--t4-text-*` — são um grupo separado, já existente em `t4-tokens.css`
desde a Etapa 1A; sua migração seletiva está documentada nos commits da
Etapa 2A, não nesta auditoria.)
