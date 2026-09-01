/* Validação da aplicação independente talents4-homologacao.
   Não depende da antiga pasta v2/ nem executa SQL ou acessa bancos. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0, checks = 0;
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function check(ok, label) { checks++; console[ok ? 'log' : 'error'](`${ok ? 'OK' : 'FALHA'}: ${label}`); if (!ok) failures++; }
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git') return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file.replaceAll(path.sep, '/')];
  });
}
const files = walk('');
const pages = { 'index.html': 'talents', 'organizacional.html': 'organization', 'contatos.html': 'contacts', 'alemao.html': 'german' };
const required = [...Object.keys(pages), 'README.md', 'PASSO_A_PASSO.md', 'VALIDACAO_V2_1.md',
  'assets/t4-v2.css', 'assets/t4-v2-core.js', 'assets/t4-v2-models.js', 'assets/t4-v2-data.js', 'assets/t4-v2-ui.js', 'assets/t4-v2-records.js', 'assets/t4-v2-pdf.js',
  ...['talents', 'organization', 'contacts', 'german'].map((name) => `assets/${name}-v2.js`),
  ...Object.keys(pages).map((file) => `demo/${file}`), 'tests/fixtures-supabase.js', 'tests/harness.mjs', 'tests/models.test.mjs', 'tests/data.test.mjs', 'tests/modules.test.mjs', 'tests/pdf.test.mjs'];
for (const file of required) check(files.includes(file), `${file} existe`);
if (failures) { console.error('Pacote incompleto; não publicar.'); process.exit(1); }

for (const file of [...new Set([...required.filter((file) => /\.(?:m?js)$/.test(file)), ...files.filter((file) => /^(scripts|tests)\/[^/]+\.mjs$/.test(file))])]) {
  const run = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  check(run.status === 0, `sintaxe de ${file}`); if (run.status) console.error(run.stderr);
}
for (const [name, module] of Object.entries(pages)) {
  for (const demo of [false, true]) {
    const file = `${demo ? 'demo/' : ''}${name}`, html = read(file);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    check(ids.length === new Set(ids).size && ids.includes('t4-app'), `${file}: IDs únicos e raiz da aplicação`);
    check(html.includes(`data-t4-module="${module}"`), `${file}: módulo correto`);
    check(/name="referrer" content="no-referrer"/.test(html), `${file}: referência não é enviada`);
    check(!/\bon[a-z]+\s*=|<script(?![^>]*src=)[^>]*>\s*\S/i.test(html), `${file}: sem handlers ou scripts inline`);
    const scriptRefs = [...html.matchAll(/<script\b([^>]*?)src="([^"]+)"[^>]*>/g)].map((m) => m[2]);
    for (const ref of [...scriptRefs, ...[...html.matchAll(/<link[^>]*href="([^"]+)"/g)].map((m) => m[1])]) {
      if (/^https:/.test(ref)) continue;
      const resolved = path.resolve(root, path.dirname(file), ref);
      check(resolved.startsWith(root + path.sep) && fs.existsSync(resolved), `${file}: referência local ${ref}`);
    }
    const core = scriptRefs.findIndex((r) => r.endsWith('t4-v2-core.js'));
    const models = scriptRefs.findIndex((r) => r.endsWith('t4-v2-models.js'));
    const data = scriptRefs.findIndex((r) => r.endsWith('t4-v2-data.js'));
    const ui = scriptRefs.findIndex((r) => r.endsWith('t4-v2-ui.js'));
    const records = scriptRefs.findIndex((r) => r.endsWith('t4-v2-records.js'));
    check(core >= 0 && core < models && models < data && data < ui && ui < records, `${file}: dependências compartilhadas na ordem correta`);
    check(/href="(?:\.\/|\.\.\/)assets\/t4-v2.css"/.test(html), `${file}: mesmo design system`);
    check(html.includes('Content-Security-Policy') && html.includes("object-src 'none'"), `${file}: política de conteúdo`);
    if (demo) {
      check(html.includes("connect-src 'none'") && !/https:\/\/cdn/.test(html), `${file}: rede bloqueada e sem SDK externo`);
      check(scriptRefs[0] === '../tests/fixtures-supabase.js', `${file}: dados fictícios carregados primeiro`);
    } else {
      check(scriptRefs[0] === 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3', `${file}: versão pública do SDK preservada e fixada`);
      check(!html.includes('fixtures-supabase'), `${file}: não carrega dados fictícios`);
    }
  }
}
const core = read('assets/t4-v2-core.js'), css = read('assets/t4-v2.css');
for (const file of Object.keys(pages)) check(core.includes(`href: './${file}'`), `switch ${file} presente no componente único`);
check((core.match(/class="t4-switch-item/g) || []).length === 1, 'quatro switches gerados por um único componente');
check(core.includes('aria-current') && core.includes('t4-skip'), 'navegação identifica a página e oferece atalho ao conteúdo');
check(core.includes('dataset.saving') && core.includes('dataset.dirty'), 'formulário protege alterações não salvas e gravação em andamento');
for (const color of ['#002a4a', '#dcd0c3', '#d50c2f', '#e63121', '#f07f00', '#fbb900', '#1e1349']) check(css.toLowerCase().includes(color), `paleta da marca contém ${color}`);
check(css.includes('@media (max-width: 1000px)') && css.includes('@media (max-width: 680px)'), 'adaptação a telas menores');
check(css.includes('prefers-reduced-motion') && css.includes(':focus-visible'), 'movimento reduzido e foco de teclado');
check(css.includes('data-selected="false"') && css.includes('data-print-empty="true"') && css.includes('@media print'), 'impressão omite campos desmarcados e seções vazias');
const cleanCSS = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
let depth = 0; for (const c of cleanCSS) { if (c === '{') depth++; if (c === '}') depth--; if (depth < 0) break; }
check(depth === 0, 'blocos CSS balanceados');
const front = required.filter((file) => file.startsWith('assets/') || Object.hasOwn(pages, file)).map(read).join('\n');
for (const [pattern, label] of [
  [/sheets\.googleapis\.com|docs\.google\.com\/spreadsheets/i, 'integração com Google Planilhas'],
  [/drive\.googleapis\.com|accounts\.google\.com\/gsi/i, 'API de Drive / OAuth Google'],
  [/\bXLSX\b|\bSheetJS\b|\bMammoth\b/i, 'bibliotecas de importação legadas'],
  [/\bclient_secret\b|\bservice_role\b|BEGIN PRIVATE KEY|ghp_[A-Za-z0-9]+/i, 'segredo administrativo'],
  [/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/, 'cache persistente de dados de negócio'],
  [/fetch\s*\(\s*['"]https?:\/\//i, 'chamada direta a serviço externo'],
  [/\.rpc\(/, 'execução de procedimento de banco pelo frontend']
]) check(!pattern.test(front), `ausência de ${label}`);
check(!required.some((file) => /\.sql$/i.test(file)), 'esta revisão de interface não depende de reaplicar SQL');
const data = read('assets/t4-v2-data.js');
check(data.includes('createClient(SUPABASE_URL, SUPABASE_ANON_KEY'), 'cliente Supabase público preservado');
check(data.includes('expectedUpdatedAt') && data.includes('page.length') && data.includes('maxRows'), 'concorrência e paginação continuam protegidas');
for (const token of data.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  check(payload.role === 'anon', 'chave embutida é pública, não administrativa');
}
console.log(`\n${checks - failures}/${checks} verificações estáticas aprovadas.`);
if (failures) process.exitCode = 1;
