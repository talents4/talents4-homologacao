/* Contratos textuais do SQL preparado. Não substituem teste em PostgreSQL real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './harness.mjs';
const sql=(name)=>readFileSync(resolve(root,'supabase/talents-v22',name),'utf8');
const clean=(s)=>s.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
test('pré e pós-checagem são SELECT, sem tabela temporária nem DML',()=>{
  for(const file of ['00_preflight.sql','20_verify.sql']){
    const code=clean(sql(file)).replace(/'(?:''|[^'])*'/g,"''");assert.match(code,/^\s*with\b/i);assert.doesNotMatch(code,/\b(create|alter|drop|insert\s+into|update\s+public|delete\s+from|truncate|revoke|grant|begin|commit)\b/i);
  }
});
test('SQL aditivo não regrava Talentos ou altera políticas dos módulos anteriores',()=>{
  const code=clean(sql('10_additive.sql'));
  assert.match(code,/^\s*begin;/i);assert.match(code,/commit;\s*$/i);
  assert.doesNotMatch(code,/\b(drop|truncate)\s|\bdelete\s+from\b|\binsert\s+into\s+public\.|\bupdate\s+public\./i);
  assert.equal((code.match(/create table public\.talent_mapping_/g)||[]).length,3);
  assert.equal((code.match(/alter table public\.talent_mapping_\w+ enable row level security/g)||[]).length,3);
  assert.match(code,/revoke all on public\.talent_mapping_profiles,public\.talent_mapping_items,public\.talent_mapping_partners from public,anon,authenticated/);
  assert.doesNotMatch(code,/create\s+(or replace\s+)?view|security\s+definer/i);
  assert.equal((code.match(/add column if not exists/g)||[]).length,9);
});
test('as três tabelas novas usam leitura e escrita autenticadas e não admitem DELETE',()=>{
  const code=clean(sql('10_additive.sql'));
  assert.equal((code.match(/create policy /g)||[]).length,9);assert.equal((code.match(/for select to authenticated/g)||[]).length,3);
  assert.equal((code.match(/for insert to authenticated/g)||[]).length,3);assert.equal((code.match(/for update to authenticated/g)||[]).length,3);
  assert.doesNotMatch(code,/for (?:all|delete) to|grant\s+(?:all|select).*?to (?:anon|public)\b/i);
  assert.match(code,/auth\.uid\(\) is not null/);assert.match(code,/u\.auth_uid is null or u\.auth_uid=auth\.uid\(\)/);
});
test('contrato do banco separa scores, valida origem e prende melhores alvos ao mesmo Talento',()=>{
  const code=clean(sql('10_additive.sql'));
  for(const f of ['professional_score','current_viability_score','projected_b1_score'])assert.match(code,new RegExp(f+' numeric\\(5,2\\) check \\('+f+' between 0 and 100\\)'));
  assert.match(code,/tm22_source_unique unique \(source_table,source_record_id\)/);assert.match(code,/tm22_items_unique_opening/);
  assert.match(code,/foreign key \(id,best_nectanet_item_id\)/);assert.match(code,/foreign key \(id,best_external_item_id\)/);
  assert.match(code,/o\.employer_id::text/);assert.match(code,/origin->>'opening_id'/);
  assert.doesNotMatch(code,/update\s+public\.(?:candidatos|talent_opportunity_matches)/i);
});
