# Convite digital — Chá da Lizzy

Convite digital responsivo para o chá de bebê da Lizzy (filha de Carol e
Jean). É uma página web de verdade — com formulário, validação e botões
que funcionam — não uma imagem estática. Uma imagem PNG separada
(`preview.png`) existe só para servir de prévia quando o link é
compartilhado no WhatsApp, Facebook etc.; ela não tem nenhum botão
interativo, só a página web tem.

Este projeto é independente do CRM que vive no restante deste
repositório (`talents4-homologacao`). Nenhum arquivo do CRM foi alterado;
tudo do convite fica isolado dentro desta pasta `cha-da-lizzy/`.

## Tecnologia

HTML + CSS + JavaScript puro (ES Modules), sem framework e sem etapa de
build — o mesmo padrão já usado no restante deste repositório (ver
`docs/design/ARQUITETURA_FRONTEND.md` na raiz). Não há `package.json`
nem dependências para instalar.

## Como rodar localmente

Não é preciso instalar nada. Basta servir a pasta com qualquer servidor
estático (não abra o `index.html` direto com `file://`, porque
`type="module"` exige `http://`). Duas opções prontas, de dentro desta
pasta:

```bash
npx serve .
# ou
npx http-server .
```

Depois abra o endereço que o comando mostrar no terminal (por padrão algo
como `http://localhost:3000` ou `http://127.0.0.1:8080`).

## Build de produção

Não existe passo de build: os arquivos desta pasta já são o resultado
final, prontos para publicar como estão (mesma filosofia do restante do
repositório). "Gerar a build" aqui significa simplesmente publicar os
arquivos de `cha-da-lizzy/` tal como estão.

## Onde alterar cada informação

Tudo fica em **um único arquivo**: [`config.js`](./config.js). Não há
texto do evento espalhado por outros arquivos.

| O que alterar | Campo em `config.js` |
|---|---|
| Nome do evento / título | `title` |
| Frase de destaque | `subtitle` |
| Nome dos pais | `parents` |
| Data | `date` |
| Horário | `time` |
| Nome do local | `venueName` |
| Endereço | `address` |
| Link do Google Maps | `mapsUrl` |
| Observação geral do evento (ex.: traje, estacionamento) | `notes` |
| Número de WhatsApp dos organizadores | `organizerWhatsapp` (só dígitos, com DDI+DDD — ex. `5511999999999`) |
| Comportamento do botão "Ver localização" | `locationMode` (`"public"`, `"after-confirmation"` ou `"not-defined"`) |
| Texto sobre o bingo | `bingoText` |
| Mostrar ou não a seção do bingo | `showBingoSection` (`true`/`false`) |
| Campo opcional "fralda ou mimo" | `showGiftField` e `giftFieldLabel` |
| Limite de acompanhantes por confirmação | `maxGuests` |
| URL pública final do convite (usada nas tags de compartilhamento) | `siteUrl` |

Todos os campos vazios (`date`, `time`, `venueName`, `address`,
`mapsUrl`, `organizerWhatsapp`) são exatamente isso: **ainda não
definidos**. Nada foi inventado. Enquanto ficarem vazios, a página mostra
mensagens como "Os detalhes serão enviados em breve." em vez de um campo
quebrado — não é necessário preencher nada para o site funcionar
corretamente hoje.

Depois de editar `config.js`, salve o arquivo e publique novamente (veja
"Como publicar" abaixo). Nenhum outro arquivo precisa ser tocado.

### Preenchendo o WhatsApp, a data, o horário e a localização

1. **WhatsApp**: abra `cha-da-lizzy/config.js`, campo `organizerWhatsapp`.
2. **Data**: mesmo arquivo, campo `date`.
3. **Horário**: mesmo arquivo, campo `time`.
4. **Localização**: campos `venueName`, `address` e `mapsUrl` — e ajuste
   `locationMode` conforme a seção abaixo.

## Como publicar

Este repositório já é publicado pelo GitHub Pages a partir da branch
padrão (ver README.md na raiz). Depois que os arquivos desta pasta
chegarem a essa branch, o convite fica disponível em:

```
https://talents4.github.io/talents4-homologacao/cha-da-lizzy/
```

Se preferir publicar em outro lugar (Netlify, Vercel, Cloudflare Pages
etc.), basta apontar o serviço para o conteúdo desta pasta — não há build
nem variável de ambiente a configurar. Se a URL final for diferente da
acima, atualize `siteUrl` em `config.js` e as tags `og:url`/`og:image` no
`<head>` de `index.html` para refletir o endereço real.

## Sobre a localização — leia antes de usar "after-confirmation"

O botão "Ver localização" tem três modos, controlados por
`locationMode`:

- **`"public"`** — abre `mapsUrl` direto em uma nova aba.
- **`"after-confirmation"`** — a página informa que o endereço será
  enviado após a confirmação de presença, com um botão para abrir o
  formulário. **A página nunca exibe `venueName`/`address`/`mapsUrl` em
  lugar nenhum enquanto estiver neste modo**, mesmo que esses campos
  estejam preenchidos.
- **`"not-defined"`** — informa que a localização ainda será divulgada
  em breve (é o estado atual, já que o local do Chá da Lizzy ainda não
  foi decidido).

**Importante:** este é um site estático, sem servidor e sem login. Isso
significa que **qualquer texto colocado em `config.js` é enviado ao
navegador de qualquer pessoa que abra a página**, esteja ela confirmada
ou não — o modo `"after-confirmation"` apenas esconde a exibição na
interface, o que **não é proteção de segurança real**: qualquer pessoa
com conhecimentos básicos consegue ver o código-fonte da página e, se o
endereço estivesse em `config.js`, encontrá-lo ali mesmo com o modo
"after-confirmation" ativo.

Por isso, enquanto o endereço do Chá da Lizzy precisar ficar reservado
apenas para quem confirmar presença, **não preencha `address` nem
`mapsUrl` neste arquivo** — deixe-os vazios e envie o endereço
manualmente (por WhatsApp, por exemplo) para quem confirmar. Só preencha
esses campos e mude `locationMode` para `"public"` quando o endereço
puder ser realmente público.

## Confirmação de presença (sem backend)

Não existe banco de dados nem servidor por trás deste convite. Ao enviar
o formulário, a página apenas monta uma mensagem de texto e abre o
WhatsApp dos organizadores (`https://wa.me/<numero>?text=<mensagem>`)
com o texto pronto — quem confirma ainda precisa efetivamente enviar a
mensagem pelo WhatsApp. Nada é "salvo" automaticamente em lugar nenhum, e
a interface nunca afirma isso.

Se `organizerWhatsapp` ainda não estiver configurado, o botão não gera um
link quebrado: a página avisa que o número precisa ser preenchido em
`config.js` e oferece um botão "Copiar confirmação" para copiar o texto
da resposta, que pode ser enviado manualmente assim que o número estiver
disponível.

### Preparado para um backend futuro

O arquivo [`rsvp-service.js`](./rsvp-service.js) isola toda a lógica de
envio da confirmação. Hoje ele só monta a mensagem/URL do WhatsApp. Para
ligar Google Sheets, Supabase ou outro banco no futuro, preencha
`apiEndpoint` em `config.js` e implemente o envio dentro da função
`submitRSVP()` desse arquivo — o comentário no próprio arquivo mostra
onde e como, sem precisar alterar o formulário nem o restante da
interface. Lembre-se de também liberar o domínio do endpoint na política
`Content-Security-Policy` (`connect-src`) declarada no `<head>` de
`index.html`.

## Compartilhamento e prévia (Open Graph)

`index.html` já inclui as tags Open Graph e Twitter Card necessárias
para que WhatsApp, Facebook e outras plataformas mostrem título,
descrição e uma imagem de prévia ao colar o link. Essa imagem de prévia é
o arquivo [`preview.png`](./preview.png) (1200×630), gerado a partir do
arquivo vetorial editável [`preview.svg`](./preview.svg).

Para editar a prévia: altere `preview.svg` e gere o PNG novamente. Como
o ambiente deste projeto não tem `rsvg-convert`/ImageMagick instalado, o
PNG foi gerado renderizando o SVG no Chromium headless via Playwright
(já disponível neste ambiente de desenvolvimento):

```bash
npx playwright screenshot --viewport-size=1200,630 \
  "file:///caminho/para/um/wrapper.html" cha-da-lizzy/preview.png
```

onde `wrapper.html` é uma página HTML mínima (`1200×630`, sem margem) que
exibe `preview.svg`. Qualquer outra ferramenta de conversão SVG→PNG
também funciona, desde que mantenha 1200×630 px.

O botão "Compartilhar convite" na própria página usa a Web Share API
nativa do navegador quando disponível; nos navegadores sem suporte, ele
copia o link do convite para a área de transferência.

## Sobre o texto do bingo

A seção "Sobre o bingo" só aparece quando `showBingoSection` é `true` em
`config.js`. Com `false` (padrão atual), ela não é renderizada em lugar
nenhum da página. O texto exibido vem de `bingoText`, no mesmo arquivo.

## Acessibilidade

- HTML semântico (`main`, `section`, `header`/`footer`, `fieldset`/`legend`, `dl`).
- Todos os campos do formulário têm `label` associado.
- O modal de confirmação usa `<dialog>` nativo (fecha com Esc, com o
  botão "×" ou tocando fora dele — funciona no celular e no desktop) e
  devolve o foco a quem abriu o modal ao fechar.
- Estados de foco visíveis em todos os elementos interativos.
- Erros de formulário usam `role="alert"` e ficam associados ao campo via
  `aria-describedby`/`aria-invalid`.
- Anima­ções são reduzidas automaticamente quando o sistema tem
  `prefers-reduced-motion` ativado.
- Botões e campos têm no mínimo ~48px de altura para toque confortável.

## Responsividade

Layout testado visualmente em 360px, 390px e 430px de largura (os
tamanhos pedidos), além de telas maiores. Não há rolagem horizontal em
nenhuma largura.
