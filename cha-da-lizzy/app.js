// Lógica interativa do convite "Chá da Lizzy".
// Toda a informação do evento vem de config.js — este arquivo não deve
// conter nenhum texto fixo sobre data, local, telefone etc.

import { inviteConfig } from './config.js';
import { submitRSVP } from './rsvp-service.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------------- Render a partir do config ----------------

function renderHero() {
  document.title = inviteConfig.title;
  document.getElementById('hero-parents').textContent = inviteConfig.parents;
  document.getElementById('footer-parents').textContent = inviteConfig.parents;

  const dateEl = document.getElementById('hero-date');
  const parts = [inviteConfig.date, inviteConfig.time].filter(Boolean);
  if (parts.length) {
    dateEl.textContent = parts.join(' às ');
    dateEl.hidden = false;
  }
}

function renderDetails() {
  const container = document.getElementById('details-content');
  container.innerHTML = '';

  const rows = [];
  if (inviteConfig.date) rows.push(['Data', inviteConfig.date]);
  if (inviteConfig.time) rows.push(['Horário', inviteConfig.time]);

  // O endereço só aparece aqui quando a localização é pública. Em
  // "after-confirmation" ou "not-defined" o endereço não é exibido em
  // nenhum lugar da página — ver README.md desta pasta.
  if (inviteConfig.locationMode === 'public') {
    const localParts = [inviteConfig.venueName, inviteConfig.address].filter(Boolean);
    if (localParts.length) rows.push(['Local', localParts.join(' — ')]);
  }

  if (inviteConfig.notes) rows.push(['Observações', inviteConfig.notes]);

  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'details-empty';
    empty.textContent = 'Os detalhes serão enviados em breve.';
    container.append(empty);
    return;
  }

  const dl = document.createElement('dl');
  dl.className = 'details-list';
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'details-row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    dl.append(row);
  }
  container.append(dl);
}

function renderBingo() {
  if (!inviteConfig.showBingoSection) return;
  document.getElementById('bingo-text').textContent = inviteConfig.bingoText;
  document.getElementById('bingo-section').hidden = false;
}

function setupGiftFieldLabel() {
  document.getElementById('field-gift-label').textContent = inviteConfig.giftFieldLabel;
}

function populateGuestsOptions() {
  const select = document.getElementById('field-guests');
  for (let i = 1; i <= inviteConfig.maxGuests; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = i === 1 ? '1 pessoa' : `${i} pessoas`;
    select.append(option);
  }
}

// ---------------- Compartilhamento ----------------

function setupShare() {
  const button = document.getElementById('btn-share');
  const feedback = document.getElementById('share-feedback');

  button.addEventListener('click', async () => {
    const shareData = {
      title: inviteConfig.title,
      text: inviteConfig.subtitle,
      url: inviteConfig.siteUrl || window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error && error.name !== 'AbortError') {
          feedback.textContent = 'Não foi possível compartilhar agora. Copie o link da página.';
        }
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareData.url);
      feedback.textContent = 'Link copiado! Cole onde quiser compartilhar.';
    } catch {
      feedback.textContent = 'Copie o link do convite na barra de endereço para compartilhar.';
    }
  });
}

// ---------------- Localização ----------------

function setupLocation(openRsvpDialog) {
  const button = document.getElementById('btn-location');
  const panel = document.getElementById('location-panel');

  button.addEventListener('click', () => {
    const mode = inviteConfig.locationMode;

    if (mode === 'public' && inviteConfig.mapsUrl) {
      window.open(inviteConfig.mapsUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    panel.innerHTML = '';
    panel.hidden = false;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'location-panel-close';
    closeBtn.textContent = 'Fechar';
    closeBtn.addEventListener('click', () => {
      panel.hidden = true;
    });
    panel.append(closeBtn);

    const text = document.createElement('p');
    text.tabIndex = -1;
    if (mode === 'after-confirmation') {
      text.textContent = 'A localização será enviada após a confirmação da presença.';
    } else {
      text.textContent = 'A localização será informada em breve.';
    }
    panel.append(text);

    if (mode === 'after-confirmation') {
      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'btn btn--primary';
      confirmBtn.textContent = 'Confirmar presença';
      confirmBtn.addEventListener('click', () => openRsvpDialog());
      panel.append(confirmBtn);
    }

    panel.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    text.focus();
  });
}

// ---------------- Formulário de confirmação ----------------

function clearAllErrors() {
  for (const id of ['err-name', 'err-attending', 'err-guests']) {
    const el = document.getElementById(id);
    el.hidden = true;
    el.textContent = '';
  }
  for (const id of ['field-name', 'field-guests']) {
    document.getElementById(id).removeAttribute('aria-invalid');
  }
}

function showFieldError(errorId, message, inputId) {
  const errorEl = document.getElementById(errorId);
  errorEl.textContent = message;
  errorEl.hidden = false;
  if (inputId) {
    document.getElementById(inputId).setAttribute('aria-invalid', 'true');
  }
}

function validatePayload(payload) {
  const errors = {};
  if (!payload.name || payload.name.trim().length < 2) {
    errors.name = 'Informe seu nome completo.';
  }
  if (payload.attending !== 'yes' && payload.attending !== 'no') {
    errors.attending = 'Selecione se você poderá comparecer.';
  }
  if (payload.attending === 'yes' && !payload.guests) {
    errors.guests = 'Selecione a quantidade de pessoas.';
  }
  return errors;
}

function setLoading(isLoading) {
  const button = document.getElementById('rsvp-submit');
  button.disabled = isLoading;
  button.querySelector('.btn-spinner').hidden = !isLoading;
  button.querySelector('.btn-label').textContent = isLoading ? 'Preparando confirmação…' : 'Confirmar via WhatsApp';
}

function showSuccess(payload, result) {
  document.getElementById('rsvp-step-form').hidden = true;
  const successStep = document.getElementById('rsvp-step-success');
  successStep.hidden = false;

  document.getElementById('success-message').textContent =
    payload.attending === 'yes'
      ? 'Que alegria! Sua confirmação está pronta — finalize o envio pelo WhatsApp para avisar Carol e Jean.'
      : 'Obrigado por avisar! Sentiremos sua falta, mas agradecemos muito o carinho.';

  const missingBox = document.getElementById('success-whatsapp-missing');
  const fallbackBox = document.getElementById('success-whatsapp-fallback');

  if (result.whatsappConfigured) {
    missingBox.hidden = true;
    fallbackBox.hidden = false;
    document.getElementById('whatsapp-fallback-link').href = result.whatsappUrl;
    window.location.href = result.whatsappUrl;
  } else {
    fallbackBox.hidden = true;
    missingBox.hidden = false;
    document.getElementById('success-message-text').value = result.message;
    document.getElementById('copy-feedback').textContent = '';
  }

  successStep.focus();
}

async function handleCopyMessage() {
  const textarea = document.getElementById('success-message-text');
  const feedback = document.getElementById('copy-feedback');
  try {
    await navigator.clipboard.writeText(textarea.value);
    feedback.textContent = 'Mensagem copiada!';
  } catch {
    textarea.focus();
    textarea.select();
    feedback.textContent = 'Não foi possível copiar automaticamente — selecione o texto e copie manualmente.';
  }
}

function resetForm() {
  const form = document.getElementById('rsvp-form');
  form.reset();
  clearAllErrors();
  document.getElementById('field-guests-wrap').hidden = true;
  document.getElementById('field-gift-wrap').hidden = true;
  document.getElementById('rsvp-step-form').hidden = false;
  document.getElementById('rsvp-step-success').hidden = true;
  setLoading(false);
}

async function handleSubmit(event) {
  event.preventDefault();
  clearAllErrors();

  const data = new FormData(event.target);
  const payload = {
    name: String(data.get('name') || '').trim(),
    attending: String(data.get('attending') || ''),
    guests: String(data.get('guests') || ''),
    notes: String(data.get('notes') || '').trim(),
    gift: String(data.get('gift') || '').trim(),
  };

  const errors = validatePayload(payload);
  if (Object.keys(errors).length) {
    if (errors.name) showFieldError('err-name', errors.name, 'field-name');
    if (errors.attending) showFieldError('err-attending', errors.attending);
    if (errors.guests) showFieldError('err-guests', errors.guests, 'field-guests');

    if (errors.name) {
      document.getElementById('field-name').focus();
    } else if (errors.attending) {
      document.querySelector('input[name="attending"]').focus();
    } else if (errors.guests) {
      document.getElementById('field-guests').focus();
    }
    return;
  }

  setLoading(true);
  await wait(500); // pausa perceptível apenas — nenhuma chamada de rede ocorre aqui
  const result = await submitRSVP(payload);
  setLoading(false);
  showSuccess(payload, result);
}

function setupForm(openRsvpDialogFn) {
  const form = document.getElementById('rsvp-form');
  const dialog = document.getElementById('rsvp-dialog');

  form.addEventListener('submit', handleSubmit);

  form.addEventListener('change', (event) => {
    if (event.target.name !== 'attending') return;
    const isYes = event.target.value === 'yes';
    document.getElementById('field-guests-wrap').hidden = !isYes;
    if (!isYes) {
      document.getElementById('field-guests').value = '';
      document.getElementById('err-guests').hidden = true;
    }
    if (inviteConfig.showGiftField) {
      document.getElementById('field-gift-wrap').hidden = !isYes;
    }
  });

  document.getElementById('btn-confirm').addEventListener('click', openRsvpDialogFn);
  document.getElementById('rsvp-close').addEventListener('click', () => dialog.close());
  document.getElementById('rsvp-done').addEventListener('click', () => dialog.close());
  document.getElementById('btn-copy-message').addEventListener('click', handleCopyMessage);

  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const insideContent =
      event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!insideContent) dialog.close();
  });
}

// ---------------- Inicialização ----------------

function init() {
  const dialog = document.getElementById('rsvp-dialog');
  const openRsvpDialog = () => {
    resetForm();
    dialog.showModal();
  };

  renderHero();
  renderDetails();
  renderBingo();
  setupGiftFieldLabel();
  populateGuestsOptions();
  setupShare();
  setupLocation(openRsvpDialog);
  setupForm(openRsvpDialog);
}

init();
