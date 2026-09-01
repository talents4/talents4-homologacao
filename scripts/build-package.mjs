/* Empacotamento local de uma revisão já salva no git. Não faz push nem deploy.
   Gera arquivos em pasta nova; nunca sobrescreve uma entrega anterior. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parent = path.resolve(process.argv[2] || path.dirname(root));
const baseline = process.argv[3] || '1662156';
function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${cmd} falhou: ${result.stderr || result.stdout || result.error}`);
  return result.stdout;
}
if (run('git', ['status', '--porcelain']).trim()) throw new Error('Salve a revisão local no git antes de empacotar; a entrega deve corresponder ao código testado.');
const revision = run('git', ['rev-parse', 'HEAD']).trim();
run(process.execPath, ['scripts/check-v2.mjs']);
run(process.execPath, ['--test', ...fs.readdirSync(path.join(root, 'tests')).filter((file) => file.endsWith('.test.mjs')).map((file) => `tests/${file}`)]);
run('git', ['cat-file', '-e', `${baseline}^{commit}`]);

const out = fs.mkdtempSync(path.join(parent, 'talents4-v21-entrega-'));
const stage = fs.mkdtempSync(path.join(parent, 'talents4-v21-stage-'));
const preview = path.join(stage, 'preview-v2-1');
fs.mkdirSync(preview);
fs.cpSync(path.join(root, 'assets'), path.join(preview, 'assets'), { recursive: true });
fs.mkdirSync(path.join(preview, 'tests'));
fs.copyFileSync(path.join(root, 'tests/fixtures-supabase.js'), path.join(preview, 'tests/fixtures-supabase.js'));
fs.copyFileSync(path.join(root, 'PREVIA.md'), path.join(preview, 'LEIA_ME.md'));
for (const name of ['index.html', 'organizacional.html', 'contatos.html', 'alemao.html']) {
  const html = fs.readFileSync(path.join(root, 'demo', name), 'utf8').replaceAll('../assets/', './assets/').replaceAll('../tests/', './tests/');
  if (!html.includes("connect-src 'none'") || /<script[^>]*src="https?:/.test(html)) throw new Error('A prévia precisa permanecer sem rede.');
  fs.writeFileSync(path.join(preview, name), html);
}
// A cópia da demonstração dispensa até mesmo a configuração pública real.
const dataFile = path.join(preview, 'assets/t4-v2-data.js');
const data = fs.readFileSync(dataFile, 'utf8')
  .replace(/const SUPABASE_URL = '[^']+';/, "const SUPABASE_URL = 'https://offline.invalid';")
  .replace(/const SUPABASE_ANON_KEY = '[^']+';/, "const SUPABASE_ANON_KEY = 'DEMONSTRACAO_SEM_CHAVE_REAL';")
  .replace("const ROOT_LOGIN = '/talents4/index.html';", "const ROOT_LOGIN = './index.html';");
if (/eyJ[A-Za-z0-9_-]+\.|\.supabase\.co/.test(data)) throw new Error('Configuração real permaneceu na cópia de demonstração.');
fs.writeFileSync(dataFile, data);
const uiFile = path.join(preview, 'assets/t4-v2-ui.js');
fs.writeFileSync(uiFile, fs.readFileSync(uiFile, 'utf8').replaceAll("'/talents4/index.html'", "'./index.html'"));

const names = ['Talents4_V2_1_PREVIA_SEM_BANCO.zip', 'Talents4_V2_1_profissional_homologacao.zip', 'Talents4_homologacao_base_8e7fa36.zip'];
run('zip', ['-q', '-r', path.join(out, names[0]), 'preview-v2-1'], stage);
run('git', ['archive', '--format=zip', `--output=${path.join(out, names[1])}`, revision]);
run('git', ['archive', '--format=zip', `--output=${path.join(out, names[2])}`, baseline]);
const hashes = [];
for (const name of names) {
  run('unzip', ['-tq', path.join(out, name)]);
  const bytes = fs.readFileSync(path.join(out, name));
  hashes.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
}
fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), `${hashes.join('\n')}\n`);
console.log(JSON.stringify({ output: out, previewStage: preview, revision, files: names }, null, 2));
