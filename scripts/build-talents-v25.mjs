/* Empacota a V2.5.2 isolada. Nunca faz push, deploy, SQL, backup ou acesso ao Supabase. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parent = path.resolve(process.argv[2] || path.dirname(root));
const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} falhou: ${result.stderr || result.stdout || result.error || 'erro desconhecido'}`);
  return result.stdout;
};
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const tests = fs.readdirSync(path.join(root, 'tests')).filter((name) => name.endsWith('.test.mjs')).sort().map((name) => `tests/${name}`);

if (run('git', ['status', '--porcelain']).trim()) throw new Error('A árvore precisa estar limpa antes de empacotar. Faça o commit local da revisão e rode novamente.');
run(process.execPath, ['scripts/check-v2.mjs']);
run(process.execPath, ['--test', ...tests]);

const output = fs.mkdtempSync(path.join(parent, 'talents4-v252-entrega-'));
const stage = fs.mkdtempSync(path.join(parent, 'talents4-v252-stage-'));
const pages = ['index.html', 'organizacional.html', 'alemao.html', 'contatos.html'];
const assets = fs.readdirSync(path.join(root, 'assets')).filter((name) => /\.(?:js|css|png)$/.test(name));

const preview = path.join(stage, 'preview-talentos-v2-5-2');
fs.mkdirSync(preview, { recursive: true });
fs.cpSync(path.join(root, 'assets'), path.join(preview, 'assets'), { recursive: true });
fs.mkdirSync(path.join(preview, 'tests'), { recursive: true });
for (const name of ['fixtures-supabase.js', 'fixtures-talents-mapping.js']) {
  fs.copyFileSync(path.join(root, 'tests', name), path.join(preview, 'tests', name));
}
for (const file of pages) {
  const html = fs.readFileSync(path.join(root, 'demo', file), 'utf8')
    .replaceAll('../assets/', './assets/')
    .replaceAll('../tests/', './tests/');
  fs.writeFileSync(path.join(preview, file), html);
}
const dataPath = path.join(preview, 'assets/t4-v2-data.js');
const data = fs.readFileSync(dataPath, 'utf8')
  .replace(/const SUPABASE_URL = '[^']+';/, "const SUPABASE_URL = 'https://offline.invalid';")
  .replace(/const SUPABASE_ANON_KEY = '[^']+';/, "const SUPABASE_ANON_KEY = 'DEMONSTRACAO_SEM_CHAVE_REAL';")
  .replace("const ROOT_LOGIN = '/talents4/index.html';", "const ROOT_LOGIN = './index.html';");
if (/\.supabase\.co|eyJ[A-Za-z0-9_-]+\./.test(data)) throw new Error('Configuração real encontrada na prévia sem banco.');
fs.writeFileSync(dataPath, data);
fs.writeFileSync(path.join(preview, 'LEIA_ME.md'), `# Talents 4 V2.5.2 · prévia sem banco

Esta pasta usa dados fictícios, não faz chamadas de rede e não grava alterações. Abra index.html.

Use / para a busca, Ctrl+K ou ⌘K para ações rápidas, e clique em nomes para abrir o Inspector lateral. Os filtros aceitam várias opções: opções do mesmo grupo usam OU; grupos diferentes usam E.
`);

const previewZip = path.join(output, 'Talents4_V2_5_2_PREVIA_SEM_BANCO.zip');
run('zip', ['-q', '-r', previewZip, 'preview-talentos-v2-5-2'], stage);
run('unzip', ['-tq', previewZip]);

const fullZip = path.join(output, 'Talents4_V2_5_2_CODIGO_COMPLETO.zip');
run('git', ['archive', '--format=zip', `--output=${fullZip}`, 'HEAD']);
run('unzip', ['-tq', fullZip]);

const incremental = path.join(stage, 'talents4-v2-5-2-incremental');
fs.mkdirSync(incremental, { recursive: true });
const copy = (relative) => {
  const source = path.join(root, relative), destination = path.join(incremental, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};
for (const relative of [
  ...pages,
  ...pages.map((file) => `demo/${file}`),
  ...assets.map((name) => `assets/${name}`),
  ...fs.readdirSync(path.join(root, 'tests')).filter((name) => name.endsWith('.mjs') || name.endsWith('.js')).map((name) => `tests/${name}`),
  'scripts/check-v2.mjs', 'scripts/build-talents-v25.mjs',
  'README.md', 'TALENTOS_V2_5.md', 'PASSO_A_PASSO.md', 'PASSO_A_PASSO_TALENTOS_V2_5.md', 'MANUAL_TALENTOS_V2_5.md', 'SUPABASE_AUDITORIA.md', 'manual-talentos.html',
  'supabase/talents-v22/00_preflight.sql', 'supabase/talents-v22/10_additive.sql', 'supabase/talents-v22/20_verify.sql', 'supabase/talents-v22/30_frontend_schema_audit.sql'
]) if (fs.existsSync(path.join(root, relative))) copy(relative);
const incrementalZip = path.join(output, 'Talents4_V2_5_2_ATUALIZACAO_INCREMENTAL.zip');
run('zip', ['-q', '-r', incrementalZip, 'talents4-v2-5-2-incremental'], stage);
run('unzip', ['-tq', incrementalZip]);

const files = [previewZip, fullZip, incrementalZip];
fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), files.map((file) => `${sha(file)}  ${path.basename(file)}`).join('\n') + '\n');
fs.writeFileSync(path.join(output, 'PASSO_A_PASSO_TALENTOS_V2_5.md'), fs.readFileSync(path.join(root, 'PASSO_A_PASSO_TALENTOS_V2_5.md')));
fs.writeFileSync(path.join(output, 'MANUAL_TALENTOS_V2_5.md'), fs.readFileSync(path.join(root, 'MANUAL_TALENTOS_V2_5.md')));
fs.writeFileSync(path.join(output, 'VERIFICACAO_LOCAL.txt'), 'Talents 4 V2.5.2 · homologação isolada\nSem push, deploy, SQL, Google Planilhas, Google Drive, backup ou alteração de banco.\n');
console.log(JSON.stringify({ output, previewZip, fullZip, incrementalZip }, null, 2));
