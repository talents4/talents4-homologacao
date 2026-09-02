/* Empacota somente a revisão local testada. Não publica, não usa rede nem executa SQL. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const parent=path.resolve(process.argv[2]||path.dirname(root));
const baseline=JSON.parse(fs.readFileSync(path.join(root,'tests/talents-v22-baseline.json'),'utf8'));
const run=(cmd,args,cwd=root)=>{
  const result=spawnSync(cmd,args,{cwd,encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.status!==0)throw new Error(`${cmd} falhou: ${result.stderr||result.stdout||result.error}`);
  return result.stdout;
};
const sha=(data)=>createHash('sha256').update(data).digest('hex');
const untouched=['organizacional.html','alemao.html','contatos.html','demo/organizacional.html','demo/alemao.html','demo/contatos.html',
  'assets/organization-v2.js','assets/german-v2.js','assets/contacts-v2.js','assets/t4-v2-core.js','assets/t4-v2-data.js',
  'assets/t4-v2-models.js','assets/t4-v2-ui.js','assets/t4-v2-records.js','assets/t4-v2-pdf.js','assets/t4-v2.css','tests/fixtures-supabase.js'];
if(run('git',['status','--porcelain']).trim())throw new Error('Registre primeiro a revisão local completa no git; não será empacotada uma combinação não testada.');
for(const file of untouched){
  const current=fs.readFileSync(path.join(root,file));
  const blob=createHash('sha1').update(`blob ${current.length}\0`).update(current).digest('hex');
  if(blob!==baseline.gitBlobs[file])throw new Error(`Fora do escopo: ${file} diverge da base publicada.`);
}
const revision=run('git',['rev-parse','HEAD']).trim();
const staticLog=run(process.execPath,['scripts/check-v2.mjs']);
const testLog=run(process.execPath,['--test',...fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>`tests/${n}`)]);
const files=[
  'index.html','demo/index.html','assets/talents-v2.js','assets/talents-mapping-models.js','assets/talents-mapping-ui.js','assets/talents-mapping.css',
  'tests/harness.mjs','tests/fixtures-talents-mapping.js','tests/talents-mapping.test.mjs','tests/talents-sql-contract.test.mjs',
  'scripts/check-v2.mjs','scripts/build-talents-v22.mjs','scripts/build-package.mjs','.github/workflows/validate-v21.yml','tests/talents-v22-baseline.json',
  'README.md','PASSO_A_PASSO.md','PREVIA.md','VALIDACAO_V2_1.md','TALENTOS_V2_2.md','PASSO_A_PASSO_TALENTOS_V2_2.md','PREVIA_TALENTOS_V2_2.md',
  'supabase/talents-v22/00_preflight.sql','supabase/talents-v22/10_additive.sql','supabase/talents-v22/20_verify.sql'
];
if(files.some(f=>untouched.includes(f)))throw new Error('Pacote incremental não pode substituir outro switch ou componente compartilhado.');
const out=fs.mkdtempSync(path.join(parent,'talentos-v22-entrega-'));
const stage=fs.mkdtempSync(path.join(parent,'talentos-v22-stage-'));
const incremental=path.join(stage,'incremental');fs.mkdirSync(incremental);
for(const file of files){
  const dst=path.join(incremental,file);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(root,file),dst);
}
fs.writeFileSync(path.join(incremental,'MANIFESTO_TALENTOS_V2_2.json'),JSON.stringify({revision,remoteBase:'fa6ecb466b22c4344090a784edddeeb9465eeb7c',scope:'Somente Talentos; scripts SQL preparados, não executados',files:files.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),unchanged:untouched.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}))},null,2)+'\n');

const preview=path.join(stage,'preview-talentos-v2-2');fs.mkdirSync(preview);fs.cpSync(path.join(root,'assets'),path.join(preview,'assets'),{recursive:true});
fs.mkdirSync(path.join(preview,'tests'));
for(const file of ['fixtures-supabase.js','fixtures-talents-mapping.js'])fs.copyFileSync(path.join(root,'tests',file),path.join(preview,'tests',file));
fs.copyFileSync(path.join(root,'PREVIA_TALENTOS_V2_2.md'),path.join(preview,'LEIA_ME.md'));
for(const file of ['index.html','organizacional.html','alemao.html','contatos.html']){
  const html=fs.readFileSync(path.join(root,'demo',file),'utf8').replaceAll('../assets/','./assets/').replaceAll('../tests/','./tests/');
  if(!html.includes("connect-src 'none'")||/<script[^>]*src="https?:/.test(html))throw new Error('Prévia precisa ser sem SDK externo e sem conexões.');
  fs.writeFileSync(path.join(preview,file),html);
}
const dataFile=path.join(preview,'assets/t4-v2-data.js');
const demoData=fs.readFileSync(dataFile,'utf8')
  .replace(/const SUPABASE_URL = '[^']+';/,"const SUPABASE_URL = 'https://offline.invalid';")
  .replace(/const SUPABASE_ANON_KEY = '[^']+';/,"const SUPABASE_ANON_KEY = 'DEMONSTRACAO_SEM_CHAVE_REAL';")
  .replace("const ROOT_LOGIN = '/talents4/index.html';","const ROOT_LOGIN = './index.html';");
if(/eyJ[A-Za-z0-9_-]+\.|\.supabase\.co/.test(demoData))throw new Error('Configuração real não deve aparecer na prévia.');
fs.writeFileSync(dataFile,demoData);
const uiFile=path.join(preview,'assets/t4-v2-ui.js');fs.writeFileSync(uiFile,fs.readFileSync(uiFile,'utf8').replaceAll("'/talents4/index.html'","'./index.html'"));

const names=['Talentos_V2_2_PREVIA_SEM_BANCO.zip','Talentos_V2_2_ATUALIZACAO_INCREMENTAL.zip'];
run('zip',['-q','-r',path.join(out,names[0]),'preview-talentos-v2-2'],stage);
run('zip',['-q','-r',path.join(out,names[1]),'.'],incremental);
for(const name of names)run('unzip',['-tq',path.join(out,name)]);
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),names.map(name=>`${sha(fs.readFileSync(path.join(out,name)))}  ${name}`).join('\n')+'\n');
fs.writeFileSync(path.join(out,'VERIFICACAO_LOCAL.txt'),`Revisão: ${revision}\nSem push/deploy/SQL real.\n${untouched.length} arquivos de execução/fixture compartilhados e outros módulos byte a byte preservados.\n\n${staticLog}\n${testLog}\n`);
fs.copyFileSync(path.join(root,'PASSO_A_PASSO_TALENTOS_V2_2.md'),path.join(out,'PASSO_A_PASSO_TALENTOS_V2_2.md'));
fs.copyFileSync(path.join(root,'supabase/talents-v22/00_preflight.sql'),path.join(out,'00_preflight.sql'));
console.log(JSON.stringify({output:out,stage,preview,revision,files:names},null,2));
