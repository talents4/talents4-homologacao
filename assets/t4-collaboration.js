/* Colaboração transversal do CRM: notificações, lembrete de P.O. e chat interno. */
(function () {
  'use strict';
  const U = window.T4V2, D = window.T4Data;
  const e = U.esc, a = U.attr;
  const state = { started: false, notifications: [], notificationsAvailable: false, chatAvailable: false, chatModal: null, chatData: null, activeConversation: '', reminder: null, interval: null, notificationSubscription: null, chatSubscription: null, lastReminderAt: 0, reminderLockAt: 0 };
  const REMINDER_INTERVAL = 45 * 60 * 1000;
  const norm = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const active = (value) => value == null || !/^(false|0|nao|no|inativo|cancelado|concluido|concluida|pronto)$/i.test(norm(value));
  const currentUser = () => String(D.profile?.username || '').trim();
  const displayUser = (username, users = []) => users.find((row) => norm(row.username) === norm(username))?.nome || username || 'Usuário';
  const formatError = (error) => error?.code === '42501' ? 'Seu perfil não tem permissão para esta colaboração.' : error?.message || 'Não foi possível carregar a colaboração agora.';

  function injectShellActions() {
    const topbar = document.querySelector('.t4-topbar');
    if (!topbar || topbar.querySelector('[data-collab-notifications]')) return;
    topbar.insertAdjacentHTML('beforeend', `<div class="t4-collab-actions" aria-label="Colaboração"><button type="button" class="t4-icon-btn t4-collab-notification-button" data-collab-notifications data-collab-action="notifications" aria-label="Notificações" title="Notificações">${U.icon('bell')}<span class="t4-collab-count" data-collab-count hidden>0</span></button><button type="button" class="t4-btn ghost sm t4-collab-chat-button" data-collab-action="chat">${U.icon('people')}<span>Chat</span></button></div>`);
    paintNotificationButton();
  }

  function notificationBody() {
    const unread = state.notifications.filter((row) => !row.read_at);
    if (!state.notificationsAvailable) return '<div class="t4-collab-empty"><strong>Notificações ainda não configuradas</strong><span>Aplique a migração de colaboração da homologação para ativar este centro.</span></div>';
    if (!state.notifications.length) return '<div class="t4-collab-empty"><strong>Nenhuma notificação</strong><span>Novas agendas, reuniões, resumos e compartilhamentos aparecerão aqui.</span></div>';
    return `<div class="t4-notification-summary"><strong>${unread.length}</strong><span>não lida${unread.length === 1 ? '' : 's'} · últimas 30 notificações preservadas</span></div><div class="t4-notification-list">${state.notifications.map((row) => `<article class="t4-notification-item ${row.read_at ? '' : 'is-unread'}"><div><span class="t4-notification-type">${e(row.type || 'CRM')}</span><h3>${e(row.title || 'Atualização no CRM')}</h3><p>${e(row.body || '')}</p><small>${e(U.formatDate(row.created_at, true))}</small></div>${row.read_at ? '' : `<button type="button" class="t4-btn ghost sm" data-collab-action="notification-read" data-collab-id="${a(row.id)}">Marcar como lida</button>`}</article>`).join('')}</div>`;
  }

  function paintNotificationButton() {
    const button = document.querySelector('[data-collab-notifications]') || document.querySelector('[data-collab-action="notifications"]');
    const count = document.querySelector('[data-collab-count]');
    if (!button || !count) return;
    const unread = state.notifications.filter((row) => !row.read_at).length;
    count.textContent = unread > 99 ? '99+' : String(unread);
    count.hidden = unread === 0;
    button.setAttribute('aria-label', unread ? `Notificações · ${unread} não lidas` : 'Notificações');
  }

  async function loadNotifications(silent = false) {
    try {
      const result = await D.optionalSelect(D.TABLES.notifications, '*', (query) => query.eq('recipient_username', currentUser()).order('created_at', { ascending: false }).limit(30));
      if (!result.available) { state.notificationsAvailable = false; paintNotificationButton(); return; }
      const previous = new Set(state.notifications.map((row) => String(row.id)));
      state.notificationsAvailable = true;
      state.notifications = result.data || [];
      paintNotificationButton();
      if (!silent && previous.size) state.notifications.filter((row) => !previous.has(String(row.id)) && !row.read_at).slice(0, 2).forEach((row) => U.toast(`${row.title || 'Nova atualização'}${row.body ? ` · ${row.body}` : ''}`, 'info', 6000));
    } catch (error) {
      console.warn('[Talents4] notificações indisponíveis:', formatError(error));
    }
  }

  async function openNotifications() {
    await loadNotifications(true);
    const drawer = U.openDrawer({ title: 'Notificações', subtitle: 'Agenda, P.O. compartilhado, reuniões e resumos do CRM.', body: notificationBody() });
    drawer.querySelector('.t4-drawer-body')?.setAttribute('data-collab-notification-body', 'true');
  }

  async function markNotificationRead(id) {
    if (!state.notificationsAvailable || !id) return;
    try {
      await D.update(D.TABLES.notifications, id, { read_at: new Date().toISOString() });
      await loadNotifications(true);
      const body = document.querySelector('[data-collab-notification-body]');
      if (body) body.innerHTML = notificationBody();
    } catch (error) { U.toast(formatError(error), 'error', 6500); }
  }

  async function poOpenTasks() {
    const [tasks, plans, members] = await Promise.all([
      D.optionalSelect(D.TABLES.tasks, 'id,title,status,due_date,owner_user_key,assigned_user_key,plan_id,deleted_at', (query) => query.is('deleted_at', null).order('due_date', { ascending: true }).limit(100)),
      D.optionalSelect(D.TABLES.poPlans, 'id,owner_username,title,deleted_at', (query) => query.is('deleted_at', null)),
      D.optionalSelect(D.TABLES.poMembers, 'plan_id,username,deleted_at', (query) => query.eq('username', currentUser()).is('deleted_at', null))
    ]);
    if (!tasks.available || !plans.available || !members.available) return [];
    const allowedPlans = new Set(plans.data.filter((row) => norm(row.owner_username) === norm(currentUser()) || members.data.some((member) => String(member.plan_id) === String(row.id))).map((row) => String(row.id)));
    return tasks.data.filter((row) => active(row.status) && (allowedPlans.has(String(row.plan_id)) || norm(row.owner_user_key || row.assigned_user_key) === norm(currentUser())));
  }

  function reminderLockAvailable() {
    const now = Date.now();
    if (state.reminderLockAt && now - state.reminderLockAt < 5 * 60 * 1000) return false;
    state.reminderLockAt = now;
    return true;
  }

  function reminderDue() {
    return !state.lastReminderAt || Date.now() - state.lastReminderAt >= REMINDER_INTERVAL;
  }

  function closeReminder() { state.reminder?.remove(); state.reminder = null; }
  function showReminder(rows) {
    closeReminder();
    const items = rows.slice(0, 5).map((row) => `<li><strong>${e(row.title || 'Tarefa sem título')}</strong><span>${e(row.due_date ? `Prazo: ${U.formatDate(row.due_date)}` : 'Sem prazo definido')}</span></li>`).join('');
    const node = document.createElement('aside');
    node.className = 't4-collab-reminder';
    node.setAttribute('role', 'status');
    node.innerHTML = `<div class="t4-collab-reminder-head"><div><span class="t4-notification-type">P.O. OPERACIONAL</span><h2>${rows.length} pendência${rows.length === 1 ? '' : 's'} em aberto</h2></div><button type="button" class="t4-icon-btn" data-collab-action="close-reminder" aria-label="Dispensar">${U.icon('close')}</button></div><ul>${items}</ul>${rows.length > 5 ? `<small>+ ${rows.length - 5} pendência${rows.length - 5 === 1 ? '' : 's'} no P.O.</small>` : ''}<footer><button type="button" class="t4-btn primary sm" data-collab-action="open-po">Abrir P.O.</button><button type="button" class="t4-btn ghost sm" data-collab-action="close-reminder">Depois</button></footer>`;
    document.body.append(node); state.reminder = node;
    state.lastReminderAt = Date.now();
  }

  async function checkPOReminder() {
    if (!currentUser() || !reminderDue() || !reminderLockAvailable()) return;
    try {
      const rows = await poOpenTasks();
      if (rows.length) showReminder(rows);
    } catch (error) { console.warn('[Talents4] lembrete de P.O. indisponível:', formatError(error)); }
  }

  async function loadUsers() {
    try {
      const result = await D.optionalSelect(D.TABLES.users, D.SELECTS.users || '*');
      return result.available ? result.data.filter((row) => active(row.ativo)) : [];
    } catch (_) { return []; }
  }

  async function loadChatData() {
    const mine = await D.optionalSelect(D.TABLES.chatParticipants, '*', (query) => query.eq('username', currentUser()).is('deleted_at', null));
    if (!mine.available) { state.chatAvailable = false; return { conversations: [], participants: [], users: [] }; }
    const ids = [...new Set(mine.data.map((row) => String(row.conversation_id)))];
    const conversations = ids.length ? await D.optionalSelect(D.TABLES.chatConversations, '*', (query) => query.in('id', ids).is('deleted_at', null).order('updated_at', { ascending: false })) : { available: true, data: [] };
    const participants = ids.length ? await D.optionalSelect(D.TABLES.chatParticipants, '*', (query) => query.in('conversation_id', ids).is('deleted_at', null)) : { available: true, data: [] };
    if (!conversations.available || !participants.available) { state.chatAvailable = false; return { conversations: [], participants: [], users: [] }; }
    state.chatAvailable = true;
    return { conversations: conversations.data || [], participants: participants.data || [], users: await loadUsers() };
  }

  function conversationTitle(conversation, data) {
    const names = data.participants.filter((row) => String(row.conversation_id) === String(conversation.id)).map((row) => displayUser(row.username, data.users)).filter((name) => norm(name) !== norm(displayUser(currentUser(), data.users)));
    return names.length ? `${conversation.title || 'Conversa'} · ${names.join(', ')}` : conversation.title || 'Conversa sem título';
  }

  function chatList(data) {
    return `<aside class="t4-chat-list"><div class="t4-chat-list-head"><div><span class="t4-notification-type">CONVERSAS</span><h3>Chat interno</h3></div><button type="button" class="t4-btn primary sm" data-collab-action="chat-new">Nova conversa</button></div>${data.conversations.length ? data.conversations.map((conversation) => `<button type="button" class="t4-chat-conversation ${String(conversation.id) === String(state.activeConversation) ? 'is-active' : ''}" data-collab-action="chat-select" data-collab-id="${a(conversation.id)}"><strong>${e(conversation.title || 'Conversa sem título')}</strong><span>${e(conversationTitle(conversation, data).replace(`${conversation.title || 'Conversa'} · `, ''))}</span></button>`).join('') : '<div class="t4-collab-empty"><strong>Nenhuma conversa</strong><span>Abra a primeira conversa com um título e participantes.</span></div>'}</aside>`;
  }

  async function renderConversation(modal, data, id) {
    state.activeConversation = String(id || '');
    const conversation = data.conversations.find((row) => String(row.id) === String(id));
    if (!conversation) { modal.querySelector('.t4-modal-body').innerHTML = `${chatList(data)}<div class="t4-chat-empty"><strong>Selecione uma conversa</strong><span>As mensagens permanecem armazenadas por conversa.</span></div>`; return; }
    let messages = [];
    try {
      const result = await D.optionalSelect(D.TABLES.chatMessages, '*', (query) => query.eq('conversation_id', conversation.id).order('created_at', { ascending: true }).limit(300));
      if (result.available) messages = result.data || [];
    } catch (error) { U.toast(formatError(error), 'error', 6000); }
    const messageHtml = messages.map((message) => `<article class="t4-chat-message ${norm(message.sender_username) === norm(currentUser()) ? 'is-mine' : ''}"><strong>${e(displayUser(message.sender_username, data.users))}</strong><p>${e(message.body || '')}</p><small>${e(U.formatDate(message.created_at, true))}</small></article>`).join('');
    modal.querySelector('.t4-modal-body').innerHTML = `<div class="t4-chat-layout">${chatList(data)}<section class="t4-chat-thread"><header><div><span class="t4-notification-type">CONVERSA</span><h3>${e(conversation.title || 'Conversa sem título')}</h3><p>${e(conversationTitle(conversation, data))}</p></div><button type="button" class="t4-btn ghost sm" data-collab-action="chat-refresh">Atualizar</button></header><div class="t4-chat-messages">${messageHtml || '<div class="t4-chat-empty"><strong>Conversa criada</strong><span>Envie a primeira mensagem para registrar o contexto.</span></div>'}</div><form class="t4-chat-compose" data-collab-chat-form data-collab-id="${a(conversation.id)}"><textarea name="body" rows="2" required placeholder="Escreva uma mensagem para a equipe…"></textarea><button type="submit" class="t4-btn primary sm">Enviar</button></form></section></div>`;
    const messagesNode = modal.querySelector('.t4-chat-messages');
    if (messagesNode) messagesNode.scrollTop = messagesNode.scrollHeight;
  }

  async function openChat() {
    const data = await loadChatData();
    state.chatData = data;
    const modal = U.openModal({ title: 'Chat interno', subtitle: 'Conversas nomeadas e armazenadas no CRM.', wide: true, body: state.chatAvailable ? '<div class="t4-skeleton"></div>' : '<div class="t4-collab-empty"><strong>Chat ainda não configurado</strong><span>Aplique a migração de colaboração da homologação para criar conversas persistentes e protegidas por participante.</span></div>' });
    state.chatModal = modal;
    if (state.chatAvailable) await renderConversation(modal, data, state.activeConversation || data.conversations[0]?.id || '');
  }

  async function newConversation(modal) {
    const users = state.chatData?.users?.length ? state.chatData.users : await loadUsers();
    const options = users.filter((row) => norm(row.username) !== norm(currentUser())).map((row) => `<label class="t4-chat-user-option"><input type="checkbox" name="participant" value="${a(row.username)}"><span><strong>${e(row.nome || row.username)}</strong><small>${e(row.username)}</small></span></label>`).join('');
    modal.querySelector('.t4-modal-body').innerHTML = `<form class="t4-chat-new" data-collab-new-chat-form><div class="t4-alert info">Dê um título claro para o assunto. Você participa automaticamente; selecione quem mais poderá acompanhar.</div><label><span>Título da conversa</span><input name="title" required maxlength="120" placeholder="Ex.: Ajustes da seleção de março"></label><fieldset><legend>Participantes</legend><div class="t4-chat-user-grid">${options || '<span class="t4-muted">Nenhum outro usuário ativo encontrado.</span>'}</div></fieldset><div class="t4-chat-new-actions"><button type="button" class="t4-btn ghost" data-collab-action="chat-back">Voltar</button><button type="submit" class="t4-btn primary">Criar conversa</button></div></form>`;
  }

  async function createConversation(form, modal) {
    const title = String(form.elements.title.value || '').trim();
    const participants = [...form.querySelectorAll('input[name="participant"]:checked')].map((input) => input.value);
    if (!title) return;
    const id = D.uuid();
    await D.insert(D.TABLES.chatConversations, { id, title, created_by: currentUser(), updated_at: new Date().toISOString(), deleted_at: null });
    await D.insert(D.TABLES.chatParticipants, [...new Set([currentUser(), ...participants])].map((username) => ({ id: D.uuid(), conversation_id: id, username, role: username === currentUser() ? 'owner' : 'member', deleted_at: null })), { single: false });
    U.toast('Conversa criada e armazenada no CRM.', 'success');
    const data = await loadChatData(); state.chatData = data; state.activeConversation = id; await renderConversation(modal, data, id);
  }

  async function sendMessage(form, modal) {
    const body = String(form.elements.body.value || '').trim();
    const id = form.dataset.collabId;
    if (!body || !id) return;
    await D.insert(D.TABLES.chatMessages, { id: D.uuid(), conversation_id: id, sender_username: currentUser(), body, created_at: new Date().toISOString() });
    form.elements.body.value = '';
    const data = await loadChatData(); state.chatData = data; await renderConversation(modal, data, id);
  }

  async function handleClick(event) {
    const element = event.target.closest?.('[data-collab-action]');
    if (!element) return;
    const action = element.dataset.collabAction, id = element.dataset.collabId || '';
    try {
      if (action === 'notifications') return openNotifications();
      if (action === 'notification-read') return markNotificationRead(id);
      if (action === 'close-reminder') return closeReminder();
      if (action === 'open-po') { location.href = './organizacional.html?view=operations'; return; }
      if (action === 'chat') return openChat();
      if (action === 'chat-new' && state.chatModal) return newConversation(state.chatModal);
      if (action === 'chat-back' && state.chatModal) return renderConversation(state.chatModal, state.chatData || { conversations: [], participants: [], users: [] }, state.activeConversation);
      if (action === 'chat-select' && state.chatModal) return renderConversation(state.chatModal, state.chatData, id);
      if (action === 'chat-refresh' && state.chatModal) { const data = await loadChatData(); state.chatData = data; return renderConversation(state.chatModal, data, state.activeConversation); }
    } catch (error) { U.toast(formatError(error), 'error', 7000); }
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (form.matches('[data-collab-chat-form]')) { event.preventDefault(); try { await sendMessage(form, state.chatModal); } catch (error) { U.toast(formatError(error), 'error', 7000); } }
    if (form.matches('[data-collab-new-chat-form]')) { event.preventDefault(); try { await createConversation(form, state.chatModal); } catch (error) { U.toast(formatError(error), 'error', 7000); } }
  }

  function subscribe() {
    try {
      state.notificationSubscription = D.subscribe([D.TABLES.notifications], () => loadNotifications(false), { name: 'collaboration-notifications' });
      state.chatSubscription = D.subscribe([D.TABLES.chatMessages, D.TABLES.chatConversations, D.TABLES.chatParticipants], async () => {
        if (!state.chatModal?.isConnected) return;
        const data = await loadChatData(); state.chatData = data; await renderConversation(state.chatModal, data, state.activeConversation);
      }, { name: 'collaboration-chat' });
    } catch (_) { /* As tabelas novas são opcionais até a migração ser aplicada. */ }
  }

  function start() {
    if (state.started || window.T4_DEMO || !D.session || !D.profile) return;
    state.started = true;
    injectShellActions();
    loadNotifications(false);
    checkPOReminder();
    state.interval = window.setInterval(checkPOReminder, REMINDER_INTERVAL);
    subscribe();
    document.addEventListener('click', handleClick);
    document.addEventListener('submit', handleSubmit);
    window.addEventListener('pagehide', () => { window.clearInterval(state.interval); state.notificationSubscription?.(); state.chatSubscription?.(); });
  }

  document.addEventListener('t4:ready', start, { once: true });
  window.T4Collaboration = Object.freeze({ start, openChat, openNotifications, refresh: () => loadNotifications(true) });
})();
