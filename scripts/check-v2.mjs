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
const required = [...Object.keys(pages),
  'assets/t4-tokens.css', 'assets/t4-components.css', 'assets/t4-v2.css', 'assets/t4-v2-core.js', 'assets/t4-v2-models.js', 'assets/t4-v2-data.js', 'assets/t4-v2-ui.js', 'assets/t4-v2-records.js', 'assets/t4-v2-pdf.js',
  ...['talents', 'organization', 'contacts', 'german'].map((name) => `assets/${name}-v2.js`),
  ...Object.keys(pages).map((file) => `demo/${file}`), 'tests/fixtures-supabase.js', 'tests/harness.mjs', 'tests/models.test.mjs', 'tests/data.test.mjs', 'tests/modules.test.mjs', 'tests/pdf.test.mjs',
  'assets/talents-mapping-models.js','assets/talents-mapping-ui.js','assets/talents-mapping.css','tests/fixtures-talents-mapping.js','tests/talents-mapping.test.mjs',
  'assets/t4-modern.js','assets/t4-modern.css','tests/modern.test.mjs','tests/employer-classification.test.mjs','tests/format-error.test.mjs',
  'assets/t4-v24.js','assets/t4-v24.css',
  'assets/t4-v25.js','assets/t4-v25.css','scripts/build-talents-v25.mjs',
  'assets/jszip.min.js','assets/t4-workbook.js','assets/t4-import-export.js','tests/import-export.test.mjs','tests/import-data.test.mjs','tests/export-roundtrip.test.mjs',
  'tests/talents-sql-contract.test.mjs','supabase/talents-v22/30_frontend_schema_audit.sql','supabase/talents-v22/40_harden_anon_grants.sql',
  'docs/mapeamento/CONTRATO_PLANILHAS.md','docs/mapeamento/CLASSIFICACAO_EMPRESAS.md','docs/mapeamento/MAPEAMENTO_SUPABASE.md','docs/mapeamento/IMPORTACAO_SQL.md','docs/mapeamento/EXPORTACAO.md',
  'supabase/talents-v22/import-planilhas/00_preflight.sql','supabase/talents-v22/import-planilhas/01_schema_additive.sql','supabase/talents-v22/import-planilhas/02_create_staging.sql',
  'supabase/talents-v22/import-planilhas/03_load_staging.sql','supabase/talents-v22/import-planilhas/04_apply_import.sql','supabase/talents-v22/import-planilhas/05_verify_import.sql','supabase/talents-v22/import-planilhas/06_rollback_batch.sql',
  'supabase/talents-v22/import-planilhas/07_auditoria_tabelas_desconhecidas.sql','supabase/talents-v22/import-planilhas/08_investigacao_origem_sistemas_paralelos.sql',
  'docs/design/REFERENCIAS_UIUX.md','docs/design/DESIGN_SYSTEM.md','docs/design/ARQUITETURA_FRONTEND.md','docs/design/FLUXOS_USUARIO.md','docs/design/FUNCIONALIDADES_INTELIGENTES.md','docs/design/CRITERIOS_ACEITACAO.md',
  'docs/auditoria/AUDITORIA_SUPABASE_INTEGRACAO.md','docs/auditoria/PLANO_MIGRACAO_IMPORTACAO_LOTE.md'];
for (const file of required) check(files.includes(file), `${file} existe`);
for (const file of [
  'TALENTOS_V2_2.md', 'PASSO_A_PASSO_TALENTOS_V2_2.md', 'PREVIA_TALENTOS_V2_2.md',
  'scripts/build-talents-v22.mjs', 'scripts/build-talents-v23.mjs', 'scripts/build-talents-v24.mjs',
  'scripts/build-package.mjs', 'tests/talents-v22-baseline.json'
]) check(!files.includes(file), `${file} legado não está no pacote`);
if (failures) { console.error('Pacote incompleto; não publicar.'); process.exit(1); }

for (const file of [...new Set([...required.filter((file) => /\.(?:m?js)$/.test(file)), ...files.filter((file) => /^(scripts|tests)\/[^/]+\.mjs$/.test(file))])]) {
  const run = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  check(run.status === 0, `sintaxe de ${file}`); if (run.status) console.error(run.stderr);
}
// Impede a reincidência da classe de bug já ocorrida: nenhum nome global pode
// ser definido por mais de um arquivo, pois a ordem de carregamento decide
// silenciosamente qual versão permanecerá ativa.
const globalOwners = new Map();
for (const file of files.filter((f) => /^assets\/.*\.js$/.test(f))) {
  for (const match of read(file).matchAll(/\b(?:window|global)\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g)) {
    const name = match[1];
    if (!globalOwners.has(name)) globalOwners.set(name, new Set());
    globalOwners.get(name).add(file);
  }
}
const collisions = [...globalOwners].filter(([, owners]) => owners.size > 1);
check(collisions.length === 0, 'nenhum nome global (window.*) é definido por mais de um arquivo');
for (const [name, owners] of collisions) console.error(`  colisão: ${name} definido em ${[...owners].join(', ')}`);

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
    const modern = scriptRefs.findIndex((r) => r.endsWith('t4-modern.js'));
    const v24 = scriptRefs.findIndex((r) => r.endsWith('t4-v24.js'));
    const v25 = scriptRefs.findIndex((r) => r.endsWith('t4-v25.js'));
    check(records >= 0 && records < modern && modern < v24 && v24 < v25, `${file}: camadas modernas carregam depois do núcleo compartilhado`);
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
const mappingCSS=read('assets/talents-mapping.css');
check(mappingCSS.includes('[data-t4-module="talents"]') && mappingCSS.includes('.tw-'), 'refinamento visual possui escopo exclusivo de Talentos');
for(const file of ['organizacional.html','alemao.html','contatos.html'])check(!read(file).includes('talents-mapping'), `${file}: não carrega o refinamento específico de Talentos`);
check(mappingCSS.includes(':focus-visible') && mappingCSS.includes('prefers-reduced-motion'), 'Talentos mantém foco de teclado e movimento reduzido');
for (const file of Object.keys(pages)) check(core.includes(`href: './${file}'`), `switch ${file} presente no componente único`);
check((core.match(/class="t4-switch-item/g) || []).length === 1, 'quatro switches gerados por um único componente');
check(core.includes('aria-current') && core.includes('t4-skip'), 'navegação identifica a página e oferece atalho ao conteúdo');
check(core.includes('data-search-clear') && core.includes("search.addEventListener('search'") && core.includes('dispatchSearch'), 'busca possui limpeza explícita e sincroniza o estado ao apagar');
check(core.includes('Pronto para apresentação') && core.includes('Apresentado ao empregador'), 'rótulos legados são traduzidos na interface');
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
  [/\bSheetJS\b|\bMammoth\b/i, 'bibliotecas de importação legadas'],
  [/\bclient_secret\b|\bservice_role\b|BEGIN PRIVATE KEY|ghp_[A-Za-z0-9]+/i, 'segredo administrativo'],
  [/\blocalStorage\b|\bindexedDB\b/, 'cache persistente de dados de negócio'],
  [/fetch\s*\(\s*['"]https?:\/\//i, 'chamada direta a serviço externo'],
  [/\.rpc\(/, 'execução de procedimento de banco pelo frontend']
]) check(!pattern.test(front), `ausência de ${label}`);
const sessionStorageFiles = [...new Set(required.filter((file) => /^(assets\/|[^/]+\.html$)/.test(file) && /\bsessionStorage\b/.test(read(file))))];
check(sessionStorageFiles.length === 0 || (sessionStorageFiles.length === 1 && sessionStorageFiles[0] === 'assets/t4-v2-core.js' && core.includes("const SIDEBAR_STATE_KEY = 't4.sidebar.collapsed'") && core.includes('readSidebarCollapsed') && core.includes('writeSidebarCollapsed')), 'armazenamento de sessão limitado à preferência visual da sidebar');
check(!front.includes('10_additive.sql') && !front.includes('supabase/migrations'), 'interface não aplica SQL automaticamente; campos novos exigem pré-checagem separada');
const data = read('assets/t4-v2-data.js');
const modern = read('assets/t4-modern.js'), modernCSS = read('assets/t4-modern.css');
check(modern.includes('T4Modern') && modern.includes('color') && modern.includes('manual'), 'camada moderna compartilhada possui cores seguras e manual');
check(modernCSS.includes('-apple-system') && modernCSS.includes('prefers-reduced-motion'), 'camada moderna usa tipografia de sistema e movimento reduzido');
const v24 = read('assets/t4-v24.js'), v24CSS = read('assets/t4-v24.css');
check(v24.includes('T4V24') && v24.includes('savedViews') && v24.includes('metricStrip'), 'workbench V2.4 possui visões salvas e indicadores');
check(v24.includes('t4-table tbody tr') && v24.includes('trigger.click'), 'workbench abre prévia da linha sem perder o contexto');
check(v24CSS.includes('--v24-blue') && v24CSS.includes('backdrop-filter') && v24CSS.includes('v24-command-list'), 'workbench V2.4 possui superfícies macOS e ações rápidas');
check(v24CSS.includes('@media (max-width: 680px)') && v24CSS.includes('prefers-reduced-motion'), 'workbench V2.4 permanece responsivo e respeita movimento reduzido');
const v25 = read('assets/t4-v25.js'), v25CSS = read('assets/t4-v25.css');
check(core.includes('data-sidebar-collapse') && core.includes('t4-sidebar-collapsed') && v25CSS.includes('body.t4-sidebar-collapsed { --v25-sidebar: 76px; }'), 'menu lateral possui recolhimento funcional compatível com a largura visual V2.5');
check(core.includes("const SIDEBAR_STATE_KEY = 't4.sidebar.collapsed'") && core.includes('document.body.classList.toggle(\'t4-sidebar-collapsed\', sidebarCollapsed)'), 'sidebar preserva a preferência visual entre módulos');
check(core.includes('aria-label="Mais espaços"') && v25CSS.includes('t4-nav-more[open] > div'), 'Mais espaços permanece acessível como flyout no menu recolhido');
check(v25CSS.includes('.t4-table td.t4-selection-cell:first-child') && v25CSS.includes('max-width: 42px'), 'coluna de seleção não ocupa a largura da primeira coluna');
check(v25CSS.includes('.t4-multi-options input[type="checkbox"]') && v25CSS.includes('.t4-sr-only'), 'filtro mantém busca larga e oculta apenas o rótulo auxiliar');
check(v25CSS.includes('width: min(360px, calc(100vw - 32px))') && v25CSS.includes('text-overflow: ellipsis'), 'popover de filtro limita a largura e preserva nomes longos');
const organizationCode = read('assets/organization-v2.js');
check(organizationCode.includes('employer-classification') && organizationCode.includes('employerPriority'), 'classificação de empregadores pode ser filtrada e priorizada');
check(organizationCode.includes("defaultView: 'employers'") && organizationCode.includes("employerClassification: 'partner'") && organizationCode.includes("employerDisplay: 'cards'"), 'Organizacional abre em Empregadores, parceiras e cartões');
check(organizationCode.includes('planning-focus') && organizationCode.includes('operations-focus') && organizationCode.includes('org-priority-panel') && organizationCode.includes("W.section('Métricas do período'"), 'Planejamento e PO organizam prioridade, fila e métricas');
check(organizationCode.includes('org-ready-card') && organizationCode.includes('operations-display') && organizationCode.includes('Lista completa') && organizationCode.includes('M.isOpen(r.status)') && v25CSS.includes('.org-operations-focus-bar') && v25CSS.includes('.org-ready-list'), 'PO alterna entre cartões de atividades e lista completa');
check(!front.match(/\bW\.badge\s*\(/), 'nenhuma tela chama um componente W.badge inexistente');
check(v25.includes('T4V25') && v25.includes('bindPopovers') && v25.includes('focusMainOnRoute'), 'camada V2.5 compartilha popovers e foco de rota');
check(v25CSS.includes('--v25-canvas') && v25CSS.includes('backdrop-filter') && !v25CSS.includes('t4-window-controls') && v25CSS.includes('v25-archive-callout'), 'camada V2.5 possui materiais macOS, blur e arquivo separado, sem controles decorativos');
check(v25CSS.includes('color-mix') && v25CSS.includes('prefers-reduced-motion') && v25CSS.includes('@supports not (backdrop-filter'), 'camada V2.5 possui cor de empregador, fallback e movimento reduzido');
const workUI = read('assets/t4-v2-ui.js'), coreShell = read('assets/t4-v2-core.js');
check(workUI.includes('multiFilter') && workUI.includes('data-multi-filter') && workUI.includes('multiOpenKey') && workUI.includes('data-multi-filter-search'), 'filtro múltiplo compartilhado mantém menu aberto e pesquisa opções');
check(workUI.includes('searchableSelect') && workUI.includes('bindSearchableSelects') && workUI.includes('data-select-search'), 'seletores longos oferecem busca sem trocar o controle nativo');
check(v25CSS.includes('background: #fff !important') && v25CSS.includes('z-index: 1001') && v25CSS.includes('@media (prefers-contrast: more)'), 'popovers têm camada opaca, contraste reforçado e empilhamento seguro');
check(files.includes('assets/talents4-logo.png') && files.includes('assets/talents4-mark.png'), 'logo oficial Talents 4 (lockup completo e marca compacta extraída dele) está no pacote');
check(coreShell.includes('t4-brand-mark') && coreShell.includes('talents4-mark.png') && coreShell.includes('t4-brand-name') && !coreShell.includes('t4-window-controls'), 'marca compacta (ícone pequeno + texto real, não palavra dentro de imagem) é renderizada sem controles decorativos no shell compartilhado');
const talentsV25 = read('assets/talents-v2.js'), mappingUI = read('assets/talents-mapping-ui.js'), organizationV25 = read('assets/organization-v2.js'), contactsV25 = read('assets/contacts-v2.js'), germanV25 = read('assets/german-v2.js');
check(talentsV25.includes('bindSearchableSelects') && mappingUI.includes('data-filter="mappingTalent"'), 'seleção de Talento também possui busca quando a lista é longa');
check(talentsV25.includes("selectionScope: 'active'") && talentsV25.includes('talentListTable') && talentsV25.includes('Liberado para apresentação'), 'Talentos inicia na fila ativa e possui lista analítica');
check(organizationV25.includes("employerScope: 'active'") && organizationV25.includes('org-opportunities') && organizationV25.includes("const workViews = () => ''"), 'Organizacional separa lista, oportunidades e navegação oficial');
check(contactsV25.includes("followupScope: 'open'") && contactsV25.includes("W.multiFilter('category'") && contactsV25.includes("label: 'Arquivo'"), 'Contatos inicia no ativo e usa filtros múltiplos');
check(germanV25.includes("classScope: 'active'") && germanV25.includes("studentScope: 'current'") && germanV25.includes("W.multiFilter('status'"), 'Alemão inicia no acompanhamento atual e usa filtros múltiplos');
check(!organizationV25.includes('T4V24.savedViews') && !talentsV25.includes('T4V24.savedViews'), 'navegação lateral não duplica a antiga barra de visões');
const importExport = read('assets/t4-import-export.js'), workbook = read('assets/t4-workbook.js');
check(importExport.includes('buildNectaWorkbook') && importExport.includes('buildMappingWorkbook') && importExport.includes('exportFiles') && !importExport.includes('Confirmar importação') && !importExport.includes('data-data-import'), 'tela de exportação gera os dois modelos oficiais e não expõe fluxo de importação de planilha');
check((talentsV25.includes('não muda a etapa') || talentsV25.includes('não altera etapas')) && importExport.includes('source.mapping.radar'), 'exportação respeita seleção manual e preserva o radar');
check(workbook.includes('readMany') && workbook.includes('freezeRows') && workbook.includes('pageBreaks'), 'leitor e escritor local preservam abas, congelamento e quebra de página');
check(talentsV25.includes('selectedTalents') && talentsV25.includes('data-talent-select') && talentsV25.includes('data-center'), 'Talentos possui seleção em massa e acesso ao Centro de dados');
check(talentsV25.includes('archivedSearchNotice') && talentsV25.includes('também no arquivo') && talentsV25.includes('Selecione ao menos um Talento'), 'arquivo e exportação deixam estados ambíguos explícitos');
check(talentsV25.includes('M.selectionBucket(item) !== \'closed\'') && organizationV25.includes('Seleções em andamento'), 'histórico de seleções não compete com a fila ativa');
check(read('manual-talentos.html').includes('./index.html?view=manual') && !/<script\b/i.test(read('manual-talentos.html')), 'endereço antigo do manual redireciona sem código legado');
for (const file of ['index.html','organizacional.html','alemao.html','contatos.html','demo/index.html','demo/organizacional.html','demo/alemao.html','demo/contatos.html']) check(read(file).includes('t4-modern.css') && read(file).includes('t4-modern.js'), `${file}: camada moderna compartilhada presente`);
for (const file of ['index.html','organizacional.html','alemao.html','contatos.html','demo/index.html','demo/organizacional.html','demo/alemao.html','demo/contatos.html']) check(read(file).includes('t4-v25.css') && read(file).includes('t4-v25.js'), `${file}: camada V2.5 compartilhada presente`);
check(data.includes('createClient(SUPABASE_URL, SUPABASE_ANON_KEY'), 'cliente Supabase público preservado');
check(data.includes('expectedUpdatedAt') && data.includes('page.length') && data.includes('maxRows'), 'concorrência e paginação continuam protegidas');
for (const token of data.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  check(payload.role === 'anon', 'chave embutida é pública, não administrativa');
}
console.log(`\n${checks - failures}/${checks} verificações estáticas aprovadas.`);
if (failures) process.exitCode = 1;
