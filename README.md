# Talents 4 · homologação

CRM de recrutamento internacional da Talents 4: Talentos, Empregadores, vagas, seleções, apresentações, contatos, agenda, acompanhamento de Alemão, planejamento organizacional e Documentação, com importação e exportação das duas planilhas oficiais. A base canônica de pessoas é a tabela `candidatos` do Supabase — não existe (e não deve existir) uma segunda base de pessoas.

## Abrir no navegador

**https://talents4.github.io/talents4-homologacao/**

Não é necessário instalar Node, npm ou rodar servidor local para usar o app. Uma demonstração sem conexão ao Supabase (dados fictícios, `connect-src 'none'`) fica em `demo/`.

## Fluxo oficial

1. Abra a URL acima e entre com seu usuário.
2. Entre em **Talentos → Centro de dados**.
3. Escolha os dois arquivos oficiais (`Mapeamento candidatos - Nectanet.xlsm` e `Mapeamento Talents 4 *.xlsx`) e confira a prévia antes de confirmar.
4. Volte para **Talentos**, marque as pessoas desejadas e abra **Exportar seleção** para gerar os modelos NectaNet/Talents 4.

A projeção de Alemão B1 é só um cenário de evolução — não aprova um Talento, não libera apresentação e não move etapa sozinha. A liberação para empregador é sempre uma decisão humana explícita.

## Estrutura do repositório

- `index.html`, `organizacional.html`, `contatos.html`, `alemao.html`, `documentacao.html` — as 5 telas do produto (produção, conectadas ao Supabase real).
- `demo/` — as mesmas 4 telas com dados fictícios, sem rede, para avaliação sem credenciais.
- `assets/` — todo o frontend (HTML/CSS/JS puro, sem build step; ver `docs/design/ARQUITETURA_FRONTEND.md` para a justificativa dessa escolha).
- `supabase/talents-v22/` — SQL de auditoria (somente leitura) e migrações aditivas do schema, incluindo `documentation/`, aplicadas manualmente via SQL Editor após revisão (nunca automaticamente pelo frontend).
- `tests/` — testes de contrato e regras de negócio (`node --test "tests/**/*.test.mjs"`) e o harness que os roda sem navegador real.
- `scripts/check-v2.mjs` — ~400 verificações estáticas de contrato, segurança e regra de negócio (`node scripts/check-v2.mjs`). Deve passar em 100% antes de qualquer entrega ser considerada pronta.
- `docs/design/` — decisão de arquitetura, design system, fluxos de usuário, critérios de aceitação.
- `docs/mapeamento/` — contrato campo a campo das duas planilhas oficiais → Supabase, classificação de empresas, importação/exportação.
- `docs/auditoria/` — auditorias do contrato Frontend ↔ Supabase e o histórico de migrações já aplicadas no banco real (fonte de verdade sobre o que já foi ou não aplicado — ver especialmente `PLANO_MIGRACAO_IMPORTACAO_LOTE.md`).

## Antes de alterar o banco

Nenhuma migração é aplicada automaticamente pelo frontend (verificado por `scripts/check-v2.mjs`). Antes de propor ou aplicar qualquer SQL novo:

1. Leia `docs/auditoria/AUDITORIA_SUPABASE_INTEGRACAO.md` para o estado confirmado do schema real.
2. Rode o preflight relevante em `supabase/talents-v22/**/00_preflight.sql` primeiro, numa consulta separada.
3. Nunca reaplique uma migração já confirmada como aplicada — consulte `docs/auditoria/PLANO_MIGRACAO_IMPORTACAO_LOTE.md`.

## Pendência aberta mais importante

O schema de importação em lote (staging + rollback + limite de segurança contra importação em massa) já existe no Supabase, mas o frontend ainda grava direto nas tabelas de produção, sem esse limite — ver `docs/mapeamento/IMPORTACAO_SQL.md`. Ligar as duas pontas depende de uma decisão de arquitetura ainda em aberto (chamadas `.rpc()` do frontend, hoje proibidas por `scripts/check-v2.mjs`).
