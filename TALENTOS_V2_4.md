# Talents 4 · V2.4 Workbench

## Por que esta versão existe

A V2.3 já tinha a separação correta entre ficha de Talento, seleção e oportunidade, mas a experiência ainda lembrava uma planilha: muitos blocos competiam pela atenção, a ação principal ficava distante do registro e o quadro Kanban parecia obrigatório.

A V2.4 muda a unidade de trabalho para **registro + contexto + próximo passo**. A lista continua sendo a leitura principal; o detalhe abre em painel lateral; o quadro é uma alternativa, nunca a única forma de acompanhar.

## Padrões de CRM incorporados

- **Visões de trabalho:** atalhos contextuais para Todos, Meus, Atenção, Em aulas e Prontos. Eles não criam cópias nem gravam dados.
- **Filtros em camadas:** busca global, filtros múltiplos da área Talentos e seleção de visualização. Dentro de um filtro, as opções continuam sendo OU; grupos diferentes continuam sendo E.
- **Preview sem perder contexto:** clicar na linha abre a ficha/seleção/empresa no painel lateral. A lista permanece no lugar.
- **Ações rápidas:** `Ctrl+K`/`⌘K` abre busca, criação e navegação; `/` leva direto à busca.
- **Densidade ajustável:** Lista para o trabalho diário, Cartões para leitura resumida, Tabela completa para conferência e colunas configuráveis.
- **Métricas de decisão:** contagem de relações, empregadores, ações, prazos vencidos e distribuição por etapa. Não há gráfico decorativo nem score inventado.
- **Cores de empregador:** uma cor estável ajuda a localizar a parceria em Talentos e Organizacional; a cor não representa aprovação ou urgência.

## Tecnologia escolhida

Nesta entrega mantemos o runtime existente: HTML sem framework, CSS nativo, JavaScript modular e Supabase. O ganho vem de componentes de interface e modelo de interação, não de adicionar uma dependência pesada ou reescrever o CRM no meio da homologação.

- `assets/t4-v24.css`: camada visual aditiva, com tipografia de sistema, superfícies translúcidas, estados de foco, responsividade e movimento reduzido.
- `assets/t4-v24.js`: visões salvas, indicadores e preview de linha.
- `assets/t4-v2-core.js`: command palette compartilhada e atalhos de teclado.
- Os painéis usam o drawer/modal já existente; não há upload, Google Planilhas, Google Drive ou cache paralelo.
- Os gráficos são barras/indicadores HTML/CSS/SVG leves. Uma biblioteca de gráficos só deve ser adicionada se houver uma decisão que não possa ser lida com segurança sem ela.

## O que não foi alterado

- nenhuma tabela, migration ou política foi executada;
- nenhuma ficha, seleção, empregador, matrícula ou atividade foi apagada;
- o Supabase continua sendo a única fonte de dados desta homologação;
- a versão principal/publicada não foi tocada;
- o quadro Kanban continua disponível como leitura opcional;
- valores antigos e campos fora da tela continuam preservados no cadastro.

## Próxima evolução planejada

Views persistentes compartilhadas por equipe, ações em massa e relatórios comparáveis exigem decisão de produto e tabela/RLS próprios. Não foram simulados como gravação local para não criar uma segunda fonte de verdade.
