// Camada de envio da confirmação de presença.
//
// Hoje este projeto não tem backend: a "confirmação" é, na prática, uma
// mensagem pronta que abre o WhatsApp dos organizadores. Este arquivo
// isola essa lógica para que, no futuro, seja possível ligar um backend
// real (Google Sheets, Supabase, etc.) sem precisar mexer no formulário
// nem no restante da interface — só no ponto marcado abaixo como
// "integração futura".

import { inviteConfig } from './config.js';

const ATTENDING_LABEL = { yes: 'SIM', no: 'NÃO' };

/** Mantém só dígitos, para montar o link https://wa.me/<numero>. */
function normalizeWhatsappNumber(rawNumber) {
  return String(rawNumber || '').replace(/\D/g, '');
}

export function isWhatsappConfigured() {
  return normalizeWhatsappNumber(inviteConfig.organizerWhatsapp).length > 0;
}

/**
 * Monta o texto de confirmação a partir dos dados do formulário.
 * @param {{name: string, attending: 'yes'|'no', guests: string, notes: string, gift: string}} payload
 */
export function buildRsvpMessage(payload) {
  const attendingLabel = ATTENDING_LABEL[payload.attending] || '';
  const guestsLine = payload.attending === 'yes' ? (payload.guests || 'Não informado') : 'Não se aplica';
  const notesLine = payload.notes && payload.notes.trim() ? payload.notes.trim() : 'Nenhuma';

  const lines = [
    `Olá! Sou ${payload.name}.`,
    'Gostaria de responder ao convite do Chá da Lizzy.',
    `Presença: ${attendingLabel}`,
    `Quantidade de pessoas: ${guestsLine}`,
    `Observações: ${notesLine}`,
  ];

  if (inviteConfig.showGiftField && payload.gift && payload.gift.trim()) {
    const giftLabel = inviteConfig.giftFieldLabel.replace(/\s*\(opcional\)\s*$/i, '').replace(/[?:]\s*$/, '');
    lines.push(`${giftLabel}: ${payload.gift.trim()}`);
  }

  return lines.join('\n');
}

/** Retorna a URL do WhatsApp, ou null se o número ainda não foi configurado. */
export function buildWhatsappUrl(message) {
  const digits = normalizeWhatsappNumber(inviteConfig.organizerWhatsapp);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Ponto único de envio da confirmação. Hoje só monta a mensagem e a URL do
 * WhatsApp (nenhuma rede é acessada, nenhum dado é "salvo" em lugar
 * nenhum). Não lança erro: quem chamar decide o que fazer com o
 * resultado.
 *
 * Integração futura (Google Sheets / Supabase / outra API): quando
 * `inviteConfig.apiEndpoint` estiver preenchido, envie `payload` para lá
 * também, por exemplo:
 *
 *   if (inviteConfig.apiEndpoint) {
 *     try {
 *       await fetch(inviteConfig.apiEndpoint, {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify(payload),
 *       });
 *       remoteSaved = true;
 *     } catch {
 *       // Falha de rede não deve travar o fluxo do WhatsApp — o convite
 *       // continua funcionando 100% sem backend.
 *     }
 *   }
 *
 * Lembre-se de também liberar o domínio do endpoint em `connect-src` no
 * <meta http-equiv="Content-Security-Policy"> do index.html — caso
 * contrário o navegador bloqueia a chamada.
 */
export async function submitRSVP(payload) {
  const message = buildRsvpMessage(payload);
  const whatsappUrl = buildWhatsappUrl(message);

  return {
    message,
    whatsappUrl,
    whatsappConfigured: whatsappUrl !== null,
    remoteSaved: false,
  };
}
