// Configuração do convite "Chá da Lizzy".
//
// Este é o ÚNICO arquivo que precisa ser editado para atualizar o convite.
// Nenhum outro arquivo (index.html, app.js, styles.css) deve ter texto do
// evento "hardcoded" — tudo é lido a partir daqui.
//
// Depois de editar, salve o arquivo e publique novamente (veja o README.md
// desta pasta para o passo a passo).
//
// IMPORTANTE: este é um site estático, público. Qualquer valor colocado
// aqui é enviado ao navegador de QUALQUER pessoa que abrir a página —
// inclusive antes de ela confirmar presença. Não preencha `address` nem
// `mapsUrl` com um endereço que deva permanecer privado enquanto
// `locationMode` for "after-confirmation" (veja a explicação abaixo).

export const inviteConfig = {
  // ---- Identidade do convite ----------------------------------------
  title: 'Chá da Lizzy',
  subtitle: 'Um momento especial para celebrar a chegada da Lizzy.',
  parents: 'Com carinho, Carol e Jean',

  // ---- Data, horário e local -----------------------------------------
  // Deixe como string vazia ('') enquanto não houver definição. Campos
  // vazios simplesmente não aparecem na página — a interface mostra uma
  // mensagem elegante ("Os detalhes serão enviados em breve.") em vez de
  // um campo quebrado ou "undefined".
  //
  // Exemplos de preenchimento quando os dados existirem:
  //   date: '16 de novembro de 2025'
  //   time: '15h'
  //   venueName: 'Espaço Jardim das Flores'
  //   address: 'Rua das Palmeiras, 123 — São Paulo, SP'
  //   mapsUrl: 'https://maps.google.com/?q=Espaço+Jardim+das+Flores'
  date: '',
  time: '',
  venueName: '',
  address: '',
  mapsUrl: '',

  // Observação livre e opcional exibida junto com data/horário/local
  // (ex.: "Traje: passeio completo", orientação de estacionamento etc.).
  // Deixe vazio para não exibir nada.
  notes: '',

  // ---- WhatsApp dos organizadores ------------------------------------
  // Somente números, com código do país e DDD, sem espaços, "+", "(" ")"
  // ou "-". Exemplo (número fictício): '5511999999999'.
  // Enquanto ficar vazio, o botão de confirmação NÃO gera um link
  // quebrado: a página explica que o número ainda precisa ser configurado
  // e oferece copiar a mensagem de confirmação.
  organizerWhatsapp: '',

  // ---- Localização -----------------------------------------------------
  // Controla o que o botão "Ver localização" faz. Opções:
  //
  // "public"            → abre `mapsUrl` em uma nova aba imediatamente.
  //                        Só use quando `mapsUrl` estiver preenchido.
  //
  // "after-confirmation" → a página avisa que o endereço será enviado
  //                        depois que a pessoa confirmar presença, e
  //                        mostra um botão para abrir o formulário de
  //                        confirmação. A página NUNCA exibe `address`
  //                        nem `mapsUrl` neste modo, mesmo que estejam
  //                        preenchidos — o envio do endereço deve ser
  //                        feito manualmente pelos organizadores (ex.:
  //                        pelo próprio WhatsApp), porque esconder um
  //                        dado só na interface não é proteção real:
  //                        qualquer pessoa pode ver o código-fonte do
  //                        site. Detalhes no README.md desta pasta.
  //
  // "not-defined"        → a página avisa que a localização ainda será
  //                        informada em breve. Use este modo enquanto o
  //                        local do evento não estiver decidido (estado
  //                        atual).
  locationMode: 'not-defined',

  // ---- Seção "Sobre o bingo" (opcional) -------------------------------
  // Quando `showBingoSection` for false, a seção não é exibida em lugar
  // nenhum da página (nem colapsada) — fica reservada para quando/se os
  // organizadores decidirem incluir a dinâmica do bingo.
  showBingoSection: false,
  bingoText:
    'Teremos um bingo especial com prêmios. As cartelas serão distribuídas conforme os itens levados para o chá.',

  // ---- Campo opcional "fralda ou mimo" no formulário de confirmação ---
  showGiftField: true,
  giftFieldLabel: 'Vai trazer fralda ou mimo? (opcional)',

  // ---- Formulário de confirmação --------------------------------------
  // Quantidade máxima de pessoas que pode ser selecionada por confirmação.
  maxGuests: 6,

  // ---- Compartilhamento / SEO -----------------------------------------
  // URL pública final do convite, usada nas tags Open Graph e na Web
  // Share API. Ajuste para a URL real depois de publicar (veja o
  // README.md desta pasta). Deixe vazio para que a página use a própria
  // URL do navegador (funciona, mas as tags <meta> estáticas do
  // index.html — lidas por WhatsApp/Facebook antes de qualquer
  // JavaScript rodar — continuam apontando para o valor abaixo).
  siteUrl: 'https://talents4.github.io/talents4-homologacao/cha-da-lizzy/',

  // ---- Preparado para o futuro -----------------------------------------
  // Enquanto vazio, o convite funciona 100% sem backend (a confirmação é
  // enviada só por WhatsApp). Se um dia vocês quiserem também registrar as
  // confirmações em uma planilha/banco (Google Sheets, Supabase etc.),
  // preencham esta URL com o endpoint (ex.: um Google Apps Script Web App
  // ou uma Supabase Edge Function) — o código em rsvp-service.js já está
  // preparado para enviar os dados para cá além do WhatsApp. Não é
  // necessário mexer em mais nenhum arquivo.
  apiEndpoint: '',
};
