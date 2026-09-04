// TALENTS 4 · Administração de contas (Edge Function)
//
// Único lugar do sistema autorizado a criar ou apagar uma conta de login de
// verdade — exige a service role key, que NUNCA pode existir no código do
// navegador (qualquer pessoa com as ferramentas de desenvolvedor a extrairia
// e teria acesso irrestrito ao banco, ignorando toda RLS). Esta função roda
// no servidor do Supabase; a chave fica só na variável de ambiente
// SUPABASE_SERVICE_ROLE_KEY, configurada como segredo do projeto (Supabase
// Studio → Edge Functions → Secrets), nunca commitada neste repositório.
//
// Deploy manual (após aplicar 54_settings_users_admin.sql):
//   supabase functions deploy admin-users
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem por padrão no
// ambiente de toda Edge Function do projeto; não precisam ser configuradas
// à mão, exceto se você usar nomes diferentes dos convencionais do Supabase.
//
// Toda ação abaixo primeiro confirma, com a service role key (que ignora
// RLS), que quem está chamando tem uma sessão válida E é administrador
// ativo em public.usuarios. Sem essa dupla checagem, qualquer usuário
// autenticado — não só administradores — poderia criar ou apagar contas.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}

const VALID_ROLES = ['admin', 'recrutador', 'viewer'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método não suportado.' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: 'Função sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY configuradas no projeto.' }, 500);
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Sessão ausente.' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // A service role key ignora RLS por definição — por isso getUser(token)
  // é a única forma confiável de saber quem está chamando: valida o JWT
  // contra o Supabase Auth em vez de confiar em qualquer campo do corpo
  // da requisição (que um cliente malicioso poderia forjar).
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: 'Sessão inválida ou expirada.' }, 401);

  const { data: callerRows, error: callerError } = await admin
    .from('usuarios')
    .select('username,role,ativo,auth_uid')
    .eq('auth_uid', userData.user.id)
    .limit(1);
  if (callerError) return json({ error: 'Não foi possível verificar o perfil de quem chamou.' }, 500);
  const caller = callerRows?.[0];
  const callerActive = !caller?.ativo || String(caller.ativo).toUpperCase() === 'SIM';
  if (!caller || caller.role !== 'admin' || !callerActive) {
    return json({ error: 'Apenas administradores podem gerenciar contas.' }, 403);
  }

  let payload;
  try { payload = await req.json(); } catch (_) { return json({ error: 'Corpo da requisição inválido.' }, 400); }
  const action = String(payload?.action || '');

  try {
    if (action === 'create') return await createUser(admin, payload, caller.username);
    if (action === 'deactivate') return await setActive(admin, payload, false);
    if (action === 'reactivate') return await setActive(admin, payload, true);
    if (action === 'delete') return await deleteUser(admin, payload);
    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (error) {
    console.error('[admin-users]', error);
    return json({ error: error?.message || 'Falha inesperada.' }, 500);
  }
});

async function createUser(admin, payload, createdByUsername) {
  const email = String(payload?.email || '').trim();
  const nome = String(payload?.nome || '').trim();
  const username = normalize(payload?.username || email.split('@')[0] || nome);
  const role = VALID_ROLES.includes(payload?.role) ? payload.role : 'viewer';
  if (!email || !nome || !username) return json({ error: 'E-mail, nome e usuário são obrigatórios.' }, 400);

  const { data: existing } = await admin.from('usuarios').select('username').ilike('username', username).limit(1);
  if (existing?.length) return json({ error: `Já existe um usuário com o identificador "${username}".` }, 409);

  // inviteUserByEmail: o Supabase envia o e-mail com o link de definição de
  // senha — esta função nunca lida com senha em texto puro nem depende de
  // SMTP próprio.
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome, username },
  });
  if (inviteError) return json({ error: `Falha ao convidar por e-mail: ${inviteError.message}` }, 400);

  const { error: profileError } = await admin.from('usuarios').insert({
    username, nome, role, ativo: 'SIM', auth_uid: invited.user.id,
  });
  if (profileError) {
    // Não deixe uma conta de login órfã, sem perfil interno correspondente.
    await admin.auth.admin.deleteUser(invited.user.id).catch(() => {});
    return json({ error: `Falha ao criar o perfil interno: ${profileError.message}` }, 500);
  }

  return json({ ok: true, username, auth_uid: invited.user.id, invited_by: createdByUsername });
}

// Padrão preferido para "excluir": revoga o login (ban efetivamente
// permanente) e marca ativo='NAO', mas preserva a linha em usuarios — o
// mesmo espírito de soft-delete usado no resto do sistema (deleted_at em
// vez de apagar). Reversível por um administrador via "reactivate".
async function setActive(admin, payload, active) {
  const username = String(payload?.username || '').trim();
  if (!username) return json({ error: 'Usuário não informado.' }, 400);
  const { data: rows, error } = await admin.from('usuarios').select('auth_uid,username').ilike('username', username).limit(1);
  if (error) return json({ error: error.message }, 500);
  const row = rows?.[0];
  if (!row) return json({ error: 'Usuário não encontrado.' }, 404);

  if (row.auth_uid) {
    const banDuration = active ? 'none' : '876000h';
    const { error: banError } = await admin.auth.admin.updateUserById(row.auth_uid, { ban_duration: banDuration });
    if (banError) return json({ error: `Falha ao atualizar o acesso de login: ${banError.message}` }, 500);
  }

  // eq() com o username exato já confirmado pela leitura acima — não reusar
  // ilike aqui, para "%"/"_" no valor de entrada não atingirem mais de uma
  // linha por engano.
  const { error: profileError } = await admin.from('usuarios').update({ ativo: active ? 'SIM' : 'NAO' }).eq('username', row.username);
  if (profileError) return json({ error: profileError.message }, 500);
  return json({ ok: true, username: row.username, active });
}

// Exclusão permanente de verdade — pedida explicitamente, mas irreversível
// para a conta de login (o histórico com o nome de usuário nas demais
// tabelas continua intacto, já que referenciam username, não o auth_uid).
// A linha de usuarios não é apagada: fica marcada ativo='NAO' e sem
// auth_uid, preservando o registro de quem foi essa pessoa no sistema.
async function deleteUser(admin, payload) {
  const username = String(payload?.username || '').trim();
  if (!username) return json({ error: 'Usuário não informado.' }, 400);
  const { data: rows, error } = await admin.from('usuarios').select('auth_uid,username').ilike('username', username).limit(1);
  if (error) return json({ error: error.message }, 500);
  const row = rows?.[0];
  if (!row) return json({ error: 'Usuário não encontrado.' }, 404);

  if (row.auth_uid) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(row.auth_uid);
    if (deleteError) return json({ error: `Falha ao apagar o login: ${deleteError.message}` }, 500);
  }

  const { error: profileError } = await admin.from('usuarios').update({ ativo: 'NAO', auth_uid: null }).eq('username', row.username);
  if (profileError) return json({ error: profileError.message }, 500);
  return json({ ok: true, username: row.username });
}
