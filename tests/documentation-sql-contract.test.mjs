import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(resolve(root, name), 'utf8');
const preflight = read('supabase/talents-v22/documentation/00_preflight.sql');
const additive = read('supabase/talents-v22/documentation/10_additive.sql');
const verify = read('supabase/talents-v22/documentation/20_verify.sql');

test('preflight e verify da Documentação são somente leitura', () => {
  for (const sql of [preflight, verify]) {
    assert.doesNotMatch(sql, /\b(insert|update|delete|alter|drop|create|grant|revoke|truncate)\b/i);
    assert.match(sql, /\bselect\b/i);
    assert.match(sql, /\bwith\b/i);
  }
});

test('migração cria uma tabela hierárquica com checklist e exclusão lógica', () => {
  assert.match(additive, /^begin;/m);
  assert.match(additive, /commit;\s*$/m);
  assert.equal((additive.match(/create table public\.documentation_nodes\b/gi) || []).length, 1);
  assert.match(additive, /parent_id uuid references public\.documentation_nodes\(id\) on delete restrict/i);
  assert.match(additive, /payload jsonb not null default '\{\}'::jsonb/i);
  assert.match(additive, /node_type = 'checklist'.*area = 'talents'.*talent_id is not null/is);
  assert.match(additive, /alter table public\.documentation_nodes enable row level security/i);
  assert.equal((additive.match(/create policy documentation_nodes_/gi) || []).length, 3);
  assert.match(additive, /grant select, insert, update on public\.documentation_nodes to authenticated/i);
  assert.doesNotMatch(additive, /grant[^;]*\bdelete\b/i);
  assert.match(additive, /where deleted_at is null/i);
  assert.match(additive, /notify pgrst/i);
});
