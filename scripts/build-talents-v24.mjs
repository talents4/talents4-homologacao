/* Empacota a V2.4 Workbench isolada. Nunca faz push, deploy, SQL ou acesso ao Supabase. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parent = path.resolve(process.argv[2] || path.dirname(root));
const run = (cmd, args, cwd = root) => {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${cmd} falhou: ${result.stderr || result.stdout || result.error}`);
  return result.stdout;
};
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

if (run('git', ['status', '--porcelain']).trim()) throw new Error('A árvore precisa estar limpa antes de empacotar.');
run(process.execPath, ['scripts/check-v2.mjs']);
run(process.execPath, ['--test', ...fs.readdirSync(path.join(root, 'tests')).filter((name) => name.endsWith('.test.mjs')).sort().map((name) => `tests/${name}`)]);

const output = fs.mkdtempSync(path.join(parent, 'talents4-v24-entrega-'));
const stage = fs.mkdtempSync(path.join(parent, 'talents4-v24-stage-'));
const pages = ['index.html', 'organizacional.html', 'alemao.html', 'contatos.html'];
const assets = fs.readdirSync(path.join(root, 'assets')).filter((name) => /\.(?:js|css)$/.test(name));

const preview = path.join(stage, 'preview-talentos-v2-4');
fs.mkdirSync(preview, { recursive: true });
fs.cpSync(path.join(root, 'assets'), path.join(preview, 'assets'), { recursive: true });
fs.mkdirSync(path.join(preview, 'tests'));
for (const name of ['fixtures-supabase.js', 'fixtures-talents-mapping.js']) fs.copyFileSync(path.join(root, 'tests', name), path.join(preview, 'tests', name));
for (const file of pages) {
  const html = fs.readFileSync(path.join(root, 'demo', file), 'utf8').replaceAll('../assets/', './assets/').replaceAll('../tests/', './tests/');
  fs.writeFileSync(path.join(preview, file), html);
}
const dataPath = path.join(preview, 'assets/t4-v2-data.js');
const data = fs.readFileSync(dataPath, 'utf8')
  .replace(/const SUPABASE_URL = '[^']+';/, "const SUPABASE_URL = 'https://offline.invalid';")
  .replace(/const SUPABASE_ANON_KEY = '[^']+';/, "const SUPABASE_ANON_KEY = 'DEMONSTRACAO_SEM_CHAVE_REAL';")
  .replace("const ROOT_LOGIN = '/talents4/index.html';", "const ROOT_LOGIN = './index.html';");
if (/\.supabase\.co|eyJ[A-Za-z0-9_-]+\./.test(data)) throw new Error('Configuração real encontrada na prévia.');
fs.writeFileSync(dataPath, data);
fs.writeFileSync(path.join(preview, 'LEIA_ME.md'), '# Talents 4 V2.4\n\nPrévia local com dados fictícios, sem conexão e sem gravação.\n\nUse `/` para buscar, `Ctrl+K`/`⌘K` para ações rápidas e clique em uma linha para abrir o preview lateral.\n');

const previewZip = path.join(output, 'Talentos_V2_4_PREVIA_SEM_BANCO.zip');
run('zip', ['-q', '-r', previewZip, 'preview-talentos-v2-4'], stage);
run('unzip', ['-tq', previewZip]);

const fullZip = path.join(output, 'Talentos_V2_4_CODIGO_COMPLETO.zip');
run('git', ['archive', '--format=zip', `--output=${fullZip}`, 'HEAD']);
run('unzip', ['-tq', fullZip]);

const incremental = path.join(stage, 'talents4-v2-4-incremental');
fs.mkdirSync(incremental);
const copy = (rel) => { const dest = path.join(incremental, rel); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(root, rel), dest); };
for (const rel of [...pages, ...pages.map((file) => `demo/${file}`), ...assets.map((name) => `assets/${name}`), 'scripts/check-v2.mjs', 'scripts/build-package.mjs', 'scripts/build-talents-v24.mjs', 'README.md', 'TALENTOS_V2_4.md', 'PASSO_A_PASSO_TALENTOS_V2_4.md', 'MANUAL_TALENTOS_V2_4.md']) if (fs.existsSync(path.join(root, rel))) copy(rel);
const incrementalZip = path.join(output, 'Talentos_V2_4_ATUALIZACAO_INCREMENTAL.zip');
run('zip', ['-q', '-r', incrementalZip, 'talents4-v2-4-incremental'], stage);
run('unzip', ['-tq', incrementalZip]);

const files = [previewZip, fullZip, incrementalZip];
fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), files.map((file) => `${sha(file)}  ${path.basename(file)}`).join('\n') + '\n');
fs.writeFileSync(path.join(output, 'PASSO_A_PASSO_TALENTOS_V2_4.md'), fs.readFileSync(path.join(root, 'PASSO_A_PASSO_TALENTOS_V2_4.md')));
fs.writeFileSync(path.join(output, 'MANUAL_TALENTOS_V2_4.md'), fs.readFileSync(path.join(root, 'MANUAL_TALENTOS_V2_4.md')));
fs.writeFileSync(path.join(output, 'VERIFICACAO_LOCAL.txt'), 'V2.4 Workbench isolada\nSem push, deploy, SQL, Google Planilhas, Google Drive ou alteração de banco.\n');
console.log(JSON.stringify({ output, previewZip, fullZip, incrementalZip }, null, 2));
