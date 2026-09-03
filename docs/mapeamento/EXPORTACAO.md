# Exportação — fidelidade ao modelo oficial

## O que está provado (testado nesta entrega, `tests/export-roundtrip.test.mjs`)

O teste faz o ciclo completo — gera a especificação do workbook com o código real do app, escreve um `.xlsx` de verdade (OOXML/ZIP) com `T4Workbook.write()`, e **relê esse arquivo real** com `T4Workbook.read()` (não compara contra o array em memória, compara contra o que sairia do gerador e entraria de volta num Excel real):

- **Nomes e ordem das abas** idênticos ao modelo oficial: `Nectanet Partner`, `Candidatos priorizados`, `Empresas detalhadas` (modelo NectaNet); uma aba por Talento selecionado (nome do Talento, como nas abas originais `Jean`, `Carla`, etc.) seguida de `Resumo BW`, `Radar NectaNet` (modelo de acompanhamento).
- **Cabeçalhos idênticos**, na mesma ordem, aos 18 campos de "Candidatos priorizados", 13 de "Nectanet Partner", 16 de acompanhamento por Talento — comparados direto contra as listas de campo (`exportHeaders`, `T.FIELDS.tracking`) que já foram cruzadas com os cabeçalhos reais das planilhas em `CONTRATO_PLANILHAS.md`.
- **Nenhum Talento fora da seleção** aparece; **nenhum campo inventado** (a linha de dado tem exatamente o número de colunas do cabeçalho).
- Nome do empregador (não o ID interno) é escrito na célula, confirmado após reler o arquivo.

## O que é preservado, mas não coberto por teste automatizado nesta entrega

- Congelamento de cabeçalho (`freezeRows`), quebras de página (`pageBreaks`) e larguras de coluna (`widths`) — o gerador já define esses valores por aba (ver `buildNectaWorkbook`/`buildMappingWorkbook`/`mappingSheet` em `assets/t4-import-export.js`); não há teste que abra o arquivo num Excel real e confira visualmente.
- Fórmulas: a exportação **nunca copia uma fórmula da planilha original** — os totais de "Resumo BW" e "Radar NectaNet" são recalculados a partir dos dados selecionados no momento da exportação, exatamente como o prompt exige ("recalcular os resultados derivados a partir dos dados selecionados", "abas de resumo... devem ser reconstruídas").

## O que **não** é preservado nesta entrega (limitação honesta, não escondida)

- **Fontes, cores, bordas e estilo visual exatos do arquivo original não são clonados.** O gerador (`t4-workbook.js`, função `styleXml()`) usa uma paleta de estilo própria, limpa e consistente com a marca Talents 4 (fonte, cor de cabeçalho, bordas), não uma cópia byte-a-byte do `styles.xml` original. Reproduzir a formatação original com fidelidade completa exigiria clonar o arquivo original inteiro e só substituir os valores das células de dado (abordagem "clonar o template"), o que é uma mudança de arquitetura maior no leitor/escritor atual — não foi implementada nesta sessão porque não daria para testar com segurança sem um ambiente para abrir o resultado num Excel real e comparar visualmente, célula a célula, contra o original.
- **Células mescladas do cabeçalho de cada aba de Talento** (ex.: nome do Talento em `A1:P1`, área em `A3:P3`, conforme `CONTRATO_PLANILHAS.md`) — o gerador atual (`mappingSheet()`) já usa `merges` para isso; confirmado por leitura de código, não por teste automatizado.

## Recomendação para uma futura iteração

Se a fidelidade visual completa (fontes/cores/bordas idênticas ao arquivo que a proprietária usa) for um requisito obrigatório (não só "quando possível", como o prompt qualifica), a via mais confiável é clonar o ZIP OOXML do arquivo oficial mais recente e substituir apenas os valores de célula nas linhas de dado, preservando every outra parte do pacote (`styles.xml`, `theme1.xml`, `sharedStrings.xml` de formatação) intacta. Isso é um projeto à parte, que precisa de um arquivo de referência sempre atualizado e de testes que abram o resultado num Excel real — não algo a fazer sem esse ambiente de verificação.
