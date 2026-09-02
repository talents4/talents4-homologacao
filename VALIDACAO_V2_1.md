# Validação e limites · V2.1

Data da revisão: 1 de setembro de 2026.

## Base preservada

- Homologação: `talents4/talents4-homologacao`, commit `8e7fa36ebc80df8b5c8db30fb70cb5e186e126c5`.
- Código antigo consultado para recuperar contratos e campos: `talents4/talents4`, base `4b1ae39c8e88a9bd87e88f97b23cd5779ca3f2f1`.
- Alterações desta entrega limitadas à cópia local da interface, documentação e testes. Outros diretórios com trabalho não publicado não foram editados.
- Nenhum push, deploy, migration, mudança de permissão ou gravação no Supabase real.

## Cobertura automatizada

Resultado local: **60/60 testes automatizados e 209/209 verificações estáticas aprovados**. Os testes fixam o relógio em 1 de setembro de 2026 para não mudar de resultado conforme a data de execução.

Os comandos completos estão no README. A suíte usa o código real de modelos, consultas, formulários e renderização, com um cliente Supabase fictício e um DOM mínimo de testes. Todas as pessoas, organizações, e-mails, documentos e IDs dessa massa são fictícios.

| Área | O que é verificado |
|---|---|
| Sessão | Perfil interno obrigatório, perfil inativo recusado, viewer sem gravações |
| Leitura | Paginação, limite explícito, erro de permissão distinto de tabela inexistente, preservação da última leitura |
| Cadastros | Campos não alterados preservados, controle otimista quando há marcador de versão, falhas parciais visíveis |
| Seleções | Fontes antigas e modernas, conflito explícito, vínculo por vaga, duplicidade e edição na origem |
| Contatos | IDs estáveis, categorias, contatos órfãos visíveis, campos compartilhados e histórico |
| Acompanhamentos | Conclusão no follow-up original; associação à ficha canônica resolvida na leitura |
| Alemão | Instituição/horários/recursos, presença separada de avaliação, ausência de dados sem alerta falso |
| Organizacional | Planejamento, decisões, tarefas, métricas e resumo; tarefa criada a partir da reunião preserva a referência |
| PDF | Presets, identificadores desmarcados, campos removidos da impressão, seleção vazia sem exportar |
| Segurança estática | CSP, dependência fixa, escape de HTML/URLs, ausência de APIs Google, segredos administrativos e cache de dados de negócio |

## O que NÃO foi comprovado nesta execução

- Aparência e interação em um navegador real: o navegador disponível recusou acesso ao servidor local com `ERR_BLOCKED_BY_CLIENT`. Não foi contornada a restrição, e não foram produzidas capturas que simulassem aprovação visual.
- Acesso autenticado às tabelas do Supabase real, recuperação de todas as linhas reais, RLS, publicações Realtime e funções/triggers instaladas.
- Paginação final e quebras do PDF em Chrome/Edge/Safari, ou qualidade de textos longos específicos de pessoas reais.
- Ausência absoluta de conflitos em gravações de múltiplas fontes. A edição de dados principais e complementos de Contatos não é uma transação única; falha parcial é detectada e explicada.
- Isolamento de banco: o endereço de homologação não tem, por si só, um banco separado.

## Sobre o Supabase já preparado

O histórico recuperado registra pré-checagens aprovadas para atividades, seleções por vaga, vínculo do professor e correção de tipos no vínculo de empregador. Isso foi usado como contexto; **não foi uma nova consulta ao banco nesta revisão**. A cópia completa do SQL efetivamente aplicado não integra esta entrega.

As funções de espelhamento de follow-ups e de cálculo acadêmico são dependências do banco existente. Os testes simulam o comportamento esperado; não certificam essas funções em produção. Não há SQL neste pacote para executá-las ou alterá-las.

## Critério de liberação

1. Aprovar visual e navegação na prévia fictícia.
2. Conferir registros conhecidos com login normal, sem salvar inicialmente.
3. Conferir alertas de leitura e correspondência das fontes.
4. Autorizar e realizar testes de gravação em banco separado ou registros controlados.
5. Somente então decidir pela adoção da versão conectada.

O resultado dos testes estáticos não deve ser apresentado como “produção 100% validada”. Esta é uma revisão implementada e testada localmente para homologação.
