# Funcionalidades inteligentes — avaliação das 20, priorização do que foi feito

O pedido original lista 20 funcionalidades para avaliar e implementar seletivamente, "sem reduzir a estabilidade". Antes de escrever qualquer linha nova, este documento primeiro **verificou o que já existe** (muita coisa foi construída em fases anteriores desta mesma conversa, sob outros nomes) para não duplicar, e só then decidiu o que valia a pena adicionar agora. Critério de priorização: valor operacional real (resolve um problema visto na auditoria) × baixo risco (não exige migração de banco) × baixo custo de manutenção.

## Já existiam antes desta entrega (verificado no código, não redocumentado do zero)

| Funcionalidade | Onde | Evidência |
|---|---|---|
| Paleta de comandos (⌘K) | `assets/t4-v2-core.js`, `openCommandPalette()` | Lista navegação + ação primária do espaço atual |
| Busca global | `assets/t4-v2-core.js`, `app.setSearchHandler` | Campo no topo, atalho `/` foca automaticamente |
| Atalhos de teclado | `assets/t4-v2-core.js` | `/` foca busca, `Esc` fecha modal/drawer/menu mobile |
| Filtros salvos / visões salvas | `assets/t4-v24.js`, `savedViews()` | Usado em Talentos (`talents-v2.js`) |
| Detecção de duplicidade | `assets/t4-v2-models.js` `duplicateGroups()`; UI em `assets/contacts-v2.js` `duplicatesView()` | Agrupa por similaridade, tela dedicada em Contatos |
| Indicador de dados incompletos | `assets/talents-v2.js:122` (`'Perfil ainda incompleto'`), `assets/t4-v2-data.js:227` (corta com aviso em vez de mostrar total errado) | Nunca mostra um total silenciosamente incompleto |
| Alertas de Talento parado/risco (explicados, não só um selo) | `assets/t4-v2-models.js` `riskReasons()`, usado em `german-v2.js` | Mostra o **motivo** do alerta, não só "atenção" — evita o "área não considerada vazia" que a auditoria original criticou |
| Personalização de coluna/densidade | `assets/t4-v2-ui.js` `tableStates` (`hidden` Set, `dense`), botões "Colunas"/"Compacto" visíveis em toda tabela | Por `id` de tabela, não global |
| Atualizações em tempo real | `assets/t4-v2-ui.js` `start()` → `D.subscribe(tables, ...)` | Já cobre Supabase Realtime onde há ganho (recarrega ao detectar mudança remota) |
| Indicadores de import/export | `docs/mapeamento/IMPORTACAO_SQL.md`, `EXPORTACAO.md` (fase anterior desta conversa) | Prévia, simulação, contagens, relatório final — já implementado na fase de mapeamento |

## Implementadas nesta entrega

| Funcionalidade | Decisão | Por quê agora |
|---|---|---|
| Filtros ativos sempre visíveis (chip removível) | Adotada — ver `FLUXOS_USUARIO.md` | Resolve um problema real e observado: filtro marcado num dropdown fechado ficava invisível, resultado vazio parecia bug. Zero risco de banco, reaproveita dado já em memória. |
| Menu lateral recolhível | Adotada — ver `FLUXOS_USUARIO.md` | Resolve a reclamação concreta de espaço horizontal em notebooks 1280–1366px. Padrão já validado (Linear/Notion, ver `REFERENCIAS_UIUX.md`), implementação só de CSS/JS local, sem estado persistido fora do Supabase. |
| Mensagens de erro sem jargão técnico | Adotada — ver `FLUXOS_USUARIO.md`, `tests/format-error.test.mjs` | Achado direto da auditoria de texto desta entrega: erro de rede/SQL sem código mapeado vazava para a tela. Baixo risco, coberto por teste. |
| Classificação de empresa (badges) | Adotada — ver `docs/mapeamento/CLASSIFICACAO_EMPRESAS.md` e `tests/employer-classification.test.mjs` | Regra de negócio explícita do pedido original ("nunca inferir parceria"), já modelada na fase de mapeamento; esta entrega conectou o dado às 3 telas onde faltava aparecer. |

## Avaliadas e **não implementadas** nesta entrega, com justificativa

| Funcionalidade | Por que ficou de fora agora |
|---|---|
| Central de notificações | Exigiria um modelo de dado novo (notificações lidas/não lidas por usuário) e uma tabela no Supabase — nenhuma migração foi criada ou aplicada nesta entrega por decisão explícita do pedido original. Fica como próximo passo natural, não como funcionalidade "esquecida". |
| Desfazer (undo) para ações reversíveis | Risco de esconder um efeito colateral real: em várias telas uma ação já dispara mais de uma escrita (ex. criar Talento + vínculo). Um "desfazer" mal implementado que reverte só a última escrita seria pior que não ter — precisaria de transação/rollback no lado do banco, que é trabalho de arquitetura de automações (ver seção de automações abaixo), não um botão de UI isolado. |
| Timeline / feed de atividade dedicado | A tela "Agenda integrada" já cumpre parte do papel (eventos ordenados por prazo, `events()` em `organization-v2.js`), e "Acervo anterior"/"Histórico de evolução" (Alemão) já mostram histórico bruto sob demanda. Um componente de timeline visual novo, dedicado, foi avaliado como **redundante com o que já existe** mais do que como uma lacuna — implementar um terceiro padrão de "linha do tempo" competiria visualmente com os dois que já funcionam. |
| Comparação de Talentos / Talento-Empresa-Vaga lado a lado | Nenhuma tela hoje tem mais de um Talento aberto ao mesmo tempo; introduzir isso exigiria um novo padrão de layout (split view ou seleção múltipla → comparação) que não foi pedido por nenhum problema concreto encontrado na auditoria. Fica como candidato a validar com uso real antes de construir. |
| Recomendações explicáveis de próximo passo | Isto é, na prática, um mecanismo de regras/score sobre os dados — o pedido original é explícito: **"Score nunca substitui decisão humana"** e **"nunca mudar etapa automaticamente"**. Qualquer versão real dessa funcionalidade pisa perto dessas duas regras fixas; implementar apressadamente arrisca violá-las. Ficou fora até haver uma especificação separada de que sinais são permitidos e como a recomendação se distingue de uma decisão automática. |
| Painel de qualidade de dados (agregado, cross-tela) | Os indicadores de incompletude já existem **por registro** (ver tabela acima). Um painel agregado (ex. "23% dos Talentos sem telefone") é síntese em cima de dados que já são lidos — viável, mas não foi priorizado porque nenhum problema de auditoria apontou falta de visibilidade agregada, só falta de indicação individual (que já foi resolvida antes desta entrega). |

## Regra que vale para as próximas rodadas

Antes de implementar qualquer item da lista acima, repetir o mesmo processo: procurar primeiro se já existe sob outro nome. As três fases anteriores desta conversa (auditoria → correções → mapeamento de planilhas) já construíram boa parte da lista original sem ela ter sido chamada assim — o risco real desta funcionalidade "inteligente" 21 é reimplementar a 6 com um nome diferente.
