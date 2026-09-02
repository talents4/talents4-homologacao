# Auditoria do contrato Frontend ↔ Supabase

O CRM cresceu no front-end antes de o contrato do banco ser fechado. Esta revisão separa o que já tem tabela/coluna do que ainda precisa de decisão de schema. A auditoria foi feita contra o código publicado em `main` e inclui Talentos, empregadores, vagas, seleções, mapeamento, organização, agenda, contatos e Alemão.

## O que está sendo protegido

- A base canônica continua sendo `public.candidatos`; não será criada uma segunda base de pessoas.
- Uma seleção continua sendo Talento + empregador + vaga + etapa.
- A Lista NectaNet e os scores são classificação/apoio à revisão; não liberam apresentação automaticamente.
- O resultado desta auditoria não lê nomes, contatos, currículos ou linhas de negócio. Ele consulta somente catálogo do PostgreSQL, colunas, RLS, políticas e existência de funções.
- Nenhuma consulta do front-end executa SQL. O script aditivo existente continua sendo manual e não deve ser aplicado por tentativa.

## Execução segura no Supabase

Faça isso no projeto de homologação correto, em uma consulta nova do **SQL Editor**:

1. Cole e execute `supabase/talents-v22/00_preflight.sql`.
2. Se o resultado não tiver `BLOQUEIO_AUSENTE`, `BLOQUEIO_TIPO`, `BLOQUEIO_RLS_DESATIVADO` ou outro bloqueio, cole e execute `supabase/talents-v22/30_frontend_schema_audit.sql`.
3. No segundo resultado, filtre ou exporte as linhas cujo `status` não seja `OK`.
4. Guarde o resultado com a data e o nome do projeto. Ele é o diagnóstico do schema, não uma lista de dados para importar.
5. Envie esse resultado para a revisão do contrato. Só depois se prepara uma migração específica para os campos realmente ausentes.

**Não execute `10_additive.sql` nesta etapa.** Ele cria tabelas, funções, políticas e nove colunas de Talentos; é uma alteração transacional no banco compartilhado e só pode ser aplicado após aprovação do preflight e comparação com o schema real. `20_verify.sql` só faz sentido depois de uma aplicação autorizada.

## Como ler o resultado

| Status | Significado | Decisão |
| --- | --- | --- |
| `OK` | Tabela/coluna/função encontrada e, para tabelas, RLS/política detectados | Manter o contrato; revisar apenas a regra funcional |
| `TABELA_AUSENTE` | O módulo não tem onde persistir os registros | Decidir se a funcionalidade deve ser ativada ou se a tabela será criada com FK, RLS e políticas |
| `COLUNA_AUSENTE_OBRIGATORIA` | Campo essencial para carregar a tela ou identidade do registro está ausente | Bloqueia a ativação do módulo até definir a coluna |
| `COLUNA_AUSENTE_FUNCIONAL` | O front-end usa o campo, mas a tela pode sobreviver com aviso/valor vazio | Criar coluna ou adaptar o formulário; não descartar o valor silenciosamente |
| `TIPO_DIVERGENTE` | A coluna existe, mas o tipo não está entre os tipos aceitos pelo front-end | Preservar dados e decidir conversão/normalização antes de qualquer alteração |
| `RLS_AUSENTE` / `SEM_POLITICAS` | A tabela pode estar acessível sem a proteção esperada; o campo `privileges` mostra também os privilégios de `anon` e `authenticated` | Não liberar gravação; revisar RLS, políticas e privilégios |
| `FUNCAO_AUSENTE` | A autenticação/autorização esperada não está disponível | Corrigir o contrato de segurança antes de habilitar escrita |

## O que a leitura do código já mostrou

1. O front-end não depende apenas das nove colunas cobertas pelo `10_additive.sql`. O formulário e o detalhe de Talentos também usam formação, experiência, documentos, disponibilidade, histórico, idioma e campos de apresentação.
2. O Centro de dados lê e grava contextos de mapeamento, parceiros, empresas, vagas e acompanhamento. Esses dados precisam ter destino explícito; não devem ser comprimidos em observações genéricas.
3. Contatos e Alemão usam tabelas próprias e a consulta `*`; isso torna a existência real das tabelas e a política de RLS especialmente importante.
4. Planejamento, reuniões, tarefas, métricas, resumos e reposições são módulos persistentes independentes. A reposição ainda guarda alguns detalhes extras dentro de `notes`; é um ponto de dívida técnica para normalização futura.
5. As tabelas `candidate_employer_matches` e `candidate_employer_links` permanecem no inventário por compatibilidade. Elas não devem ser apagadas enquanto houver registros legados ou importações que apontem para elas.

## Critério para a próxima migração

Depois do resultado real:

- campos ausentes na tabela canônica serão adicionados somente com tipo, default, nulabilidade e origem documentados;
- tabelas novas receberão chave, FK, índices, RLS, políticas e teste de leitura/escrita antes da interface ser considerada concluída;
- colunas existentes com nomes diferentes serão mapeadas, não duplicadas;
- campos de planilha sem destino serão listados como pendência de contrato, nunca ignorados durante a importação;
- nenhuma limpeza de registros, exclusão de tabela ou conversão de tipo fará parte de uma migração aditiva sem aprovação separada.

O arquivo `30_frontend_schema_audit.sql` é deliberadamente somente leitura para permitir esta decisão sem repetir o incidente de importação ou alterar a base compartilhada.
