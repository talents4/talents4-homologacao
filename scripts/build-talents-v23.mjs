/* Empacota a V2.3 isolada. Nunca faz push, deploy, chamada ao Supabase ou SQL. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parent = path.resolve(process.argv[2] || path.dirname(root));
const run = (cmd, args, cwd = root) => { const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 }); if (r.status !== 0) throw new Error(`${cmd} falhou: ${r.stderr || r.stdout || r.error}`); return r.stdout; };
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if (run('git', ['status', '--porcelain']).trim()) throw new Error('A árvore precisa estar limpa antes de empacotar.');
run(process.execPath, ['scripts/check-v2.mjs']);
run(process.execPath, ['--test', ...fs.readdirSync(path.join(root, 'tests')).filter(n => n.endsWith('.test.mjs')).sort().map(n => `tests/${n}`)]);

const output = fs.mkdtempSync(path.join(parent, 'talents4-v23-entrega-'));
const stage = fs.mkdtempSync(path.join(parent, 'talents4-v23-stage-'));
const preview = path.join(stage, 'preview-talentos-v2-3'); fs.mkdirSync(preview, { recursive: true });
const files = ['index.html', 'organizacional.html', 'alemao.html', 'contatos.html'];
const assets = fs.readdirSync(path.join(root, 'assets')).filter(n => /\.(js|css)$/.test(n));
fs.cpSync(path.join(root, 'assets'), path.join(preview, 'assets'), { recursive: true });
fs.mkdirSync(path.join(preview, 'tests'));
for (const n of ['fixtures-supabase.js', 'fixtures-talents-mapping.js']) fs.copyFileSync(path.join(root, 'tests', n), path.join(preview, 'tests', n));
for (const file of files) {
  let html = fs.readFileSync(path.join(root, 'demo', file), 'utf8').replaceAll('../assets/', './assets/').replaceAll('../tests/', './tests/');
  fs.writeFileSync(path.join(preview, file), html);
}
// Garante que a prévia não contenha a URL/chave reais nem possa fazer rede.
const dataPath = path.join(preview, 'assets/t4-v2-data.js');
let data = fs.readFileSync(dataPath, 'utf8').replace(/const SUPABASE_URL = '[^']+';/, "const SUPABASE_URL = 'https://offline.invalid';").replace(/const SUPABASE_ANON_KEY = '[^']+';/, "const SUPABASE_ANON_KEY = 'DEMONSTRACAO_SEM_CHAVE_REAL';").replace("const ROOT_LOGIN = '/talents4/index.html';", "const ROOT_LOGIN = './index.html';");
if (/\.supabase\.co|eyJ[A-Za-z0-9_-]+\./.test(data)) throw new Error('Configuração real encontrada na prévia.');
fs.writeFileSync(dataPath, data);
fs.writeFileSync(path.join(preview, 'LEIA_ME.md'), `# Talentos 4 V2.3\n\nPrévia local com dados fictícios, sem conexão e sem gravação.\n\nFluxo: **Talentos** → ficha única → **Acompanhamento**. **Apresentações** depende de liberação humana. **Mercado/Radar NectaNet** mostra oportunidades e não altera a etapa.\n`);
fs.writeFileSync(path.join(preview, 'manual-talentos.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./assets/t4-v2.css"><link rel="stylesheet" href="./assets/t4-modern.css"><script src="./assets/t4-modern.js"></script><main id="manual"></main><script>document.getElementById('manual').innerHTML=window.T4Modern.manual();</script>`);
const zipPreview = path.join(output, 'Talentos_V2_3_PREVIA_SEM_BANCO.zip'); run('zip', ['-q', '-r', zipPreview, 'preview-talentos-v2-3'], stage); run('unzip', ['-tq', zipPreview]);

const incremental = path.join(stage, 'talents4-v2-3-incremental'); fs.mkdirSync(incremental);
const copy = (rel) => { const dest = path.join(incremental, rel); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(root, rel), dest); };
const sourceFiles = [...files, 'demo/index.html', 'demo/organizacional.html', 'demo/alemao.html', 'demo/contatos.html', ...assets.map(n => `assets/${n}`), ...fs.readdirSync(path.join(root, 'scripts')).filter(n => /check-v2|build-package|build-talents-v23/.test(n)).map(n => `scripts/${n}`), ...fs.readdirSync(path.join(root, 'tests')).filter(n => /\.mjs$|fixtures.*\.js$/.test(n)).map(n => `tests/${n}`), 'README.md', 'TALENTOS_V2_3.md', 'PASSO_A_PASSO_TALENTOS_V2_3.md', 'MANUAL_TALENTOS_V2_3.md'];
for (const rel of sourceFiles) if (fs.existsSync(path.join(root, rel))) copy(rel);
const zipIncremental = path.join(output, 'Talentos_V2_3_ATUALIZACAO_INCREMENTAL.zip'); run('zip', ['-q', '-r', zipIncremental, 'talents4-v2-3-incremental'], stage); run('unzip', ['-tq', zipIncremental]);
const hashes = [zipPreview, zipIncremental].map(file => `${sha(file)}  ${path.basename(file)}`).join('\n') + '\n'; fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), hashes);
fs.writeFileSync(path.join(output, 'PASSO_A_PASSO_TALENTOS_V2_3.md'), fs.readFileSync(path.join(root, 'PASSO_A_PASSO_TALENTOS_V2_3.md')));
fs.writeFileSync(path.join(output, 'MANUAL_TALENTOS_V2_3.md'), fs.readFileSync(path.join(root, 'MANUAL_TALENTOS_V2_3.md')));
fs.writeFileSync(path.join(output, 'VERIFICACAO_LOCAL.txt'), `V2.3 isolada\nRevisão local sem push, deploy, banco ou Google Planilhas.\nArquivos de módulos existentes preservados por cópia; alterações limitadas ao design compartilhado e Talentos.\n`);
console.log(JSON.stringify({ output, stage, preview, files: [path.basename(zipPreview), path.basename(zipIncremental)] }, null, 2));
