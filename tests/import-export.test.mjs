import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/t4-import-export.js');
const importer = globalThis.T4ImportExport;

const presentationHeaders = ['Lista Nectanet', 'Nome', 'Visto', 'Profissional Qualificado', 'Novo CV', 'CV', 'Idade', 'Área principal', 'Cluster', 'Anos de experiência', 'Alemão', 'Inglês', 'Outros idiomas', 'Empresa principal', 'Empresa alternativa 1', 'Empresa alternativa 2', 'Resumo do candidato', 'Observação'];
const partnerHeaders = ['nectanet source', 'Unternehmen', 'Geschäftsführer', 'Kontakt-E-Mail', 'Personaler', 'Kontakt-E-Mail 2', 'Kontaktstatus', 'Anzahl Talentos', 'Passende Talentos', 'Arbeitsbereich', 'Deutschniveau', 'Englischniveau', 'PS'];
const companyHeaders = ['Empresa', 'Setor / tipo', 'Vagas em aberto', 'Descrição da empresa', 'E-mail para envio'];
const trackingHeaders = ['Empresa', 'NectaNet?', 'Status', 'Aderência profissional', 'Viabilidade atual', 'Viabilidade projetada — B1 em 3 meses', 'Vaga / situação', 'Tipo / área', 'Por que se encaixa', 'Barreira / risco', 'Idioma / requisito', 'Anerkennung / Approbation', 'Local', 'Contato', 'Link direto / oficial', 'Verificado em'];

test('reconhece os dois modelos, os contextos e as abas auxiliares', () => {
  const first = { name: 'Mapeamento candidatos - Nectanet.xlsm', sheets: [
    { name: 'Nectanet Partner', rows: [partnerHeaders, ['NectaNet', 'Empresa Azul', 'CEO', 'ceo@azul.test', 'RH', 'rh@azul.test', 'A contatar', 2, 'Jean\nCarla', 'TI', 'B1', 'B2', 'Observação']] },
    { name: 'Candidatos priorizados', rows: [presentationHeaders, ['Sim', 'Jean', 'OK', 'Fachkraft', 'Feito', 'https://cv.test', 31, 'Redes', 'Infra', 8, 'B1', 'C1', 'Português', 'Empresa Azul', '', '', 'Perfil', 'Nota']] },
    { name: 'Empresas detalhadas', rows: [companyHeaders, ['Empresa Azul', 'Tecnologia', '2', 'Empresa de teste', 'envio@azul.test']] }
  ] };
  const second = { name: 'Cópia de Mapeamento Talents 4.xlsx', sheets: [
    { name: 'Jean', rows: [['Jean'], [], ['Redes / ISP'], [], ['Perfil comprovado', 'Sim'], ['Idiomas', 'Alemão B1'], ['Regra desta revisão', 'Revisar antes de apresentar'], trackingHeaders, ['Empresa Azul', 'Sim', 'ABERTA', 94, 65, 80, 'Network Engineer', 'Redes', 'Boa aderência', 'Validar automação', 'B2', 'Não', 'Offenburg', 'rh@azul.test', 'https://azul.test/vaga', '31/08/2026']] },
    { name: 'Resumo BW', rows: [['Resumo'], [], [], ['Talento', 'Perfil', 'Itens mapeados', 'Vagas abertas', 'NectaNet abertas', 'Abertas fit ≥90', 'Abertas viab. atual ≥60', 'Abertas viab. B1 ≥60', 'Melhor NectaNet', 'Melhor BW externa', 'Barreira principal', 'Prioridade'], ['Jean', 'Redes', 1, 1, 1, 1, 1, 1, 'Empresa Azul — Network Engineer', '', 'Revisar', 'ALTA']] },
    { name: 'Radar NectaNet', rows: [['Radar'], [], ['Empresa', 'Talento(s)', 'Status', 'Aderência', 'Viab. atual', 'Viab. B1 (3 meses)', 'Vaga / alvo', 'Barreira / observação', 'Local', 'Link', 'Verificado em'], ['Empresa Azul', 'Jean', 'ABERTA', 94, 65, 80, 'Network Engineer', 'Validar automação', 'Offenburg', 'https://azul.test/vaga', '31/08/2026']] }
  ] };
  const result = importer.parseBooks([first, second]);
  assert.deepEqual(result.stats, { files: 2, candidates: 1, partners: 1, companies: 1, tracking: 1, profiles: 1, summary: 1, radar: 1 });
  assert.equal(result.talentNames[0], 'Jean');
  assert.equal(result.mapping.contexts[0].regra_revisao, 'Revisar antes de apresentar');
  assert.equal(result.mapping.summaries[0].prioridade_mapeamento, 'ALTA');
  assert.equal(result.mapping.radar[0].official_url, 'https://azul.test/vaga');
});

test('mantém abas desconhecidas na prévia sem gravá-las silenciosamente', () => {
  const result = importer.parseBooks([{ name: 'modelo.xlsx', sheets: [{ name: 'Aba nova', rows: [['campo'], ['valor']] }] }]);
  assert.ok(result.warnings.some((warning) => warning.includes('Aba não reconhecida')));
  assert.equal(result.stats.candidates, 0);
});

test('reconstrói fórmulas de parceiro a partir da aba oficial de Talentos', () => {
  const candidateHeaders = ['Lista Nectanet', 'Nome', 'Visto', 'Profissional Qualificado', 'Novo CV', 'CV', 'Idade', 'Área principal', 'Cluster', 'Anos de experiência', 'Alemão', 'Inglês', 'Outros idiomas', 'Empresa principal', 'Empresa alternativa 1', 'Empresa alternativa 2', 'Resumo do candidato', 'Observação'];
  const partnerHeaders = ['nectanet source', 'Unternehmen', 'Geschäftsführer', 'Kontakt-E-Mail', 'Personaler', 'Kontakt-E-Mail 2', 'Kontaktstatus', 'Anzahl Kandidaten', 'Passende Kandidaten', 'Arbeitsbereich', 'Deutschniveau', 'Englischniveau', 'PS'];
  const result = importer.parseBooks([{ name: 'modelo.xlsm', sheets: [
    { name: 'Nectanet Partner', rows: [partnerHeaders, ['NectaNet MATCH', 'Empresa Azul', '', '', '', '', 'Aber', 1, 'IFERROR(__xludf.DUMMYFUNCTION("FILTER(...)"),"")', 'IFERROR(__xludf.DUMMYFUNCTION("FILTER(...)"),"")', 'IFERROR(__xludf.DUMMYFUNCTION("FILTER(...)"),"")', 'IFERROR(__xludf.DUMMYFUNCTION("FILTER(...)"),"")', ''] ] },
    { name: 'Candidatos priorizados', rows: [candidateHeaders, ['Sim', 'Jean', '', '', '', '', 30, 'Redes', '', '8', 'B1', 'B2', '', 'Empresa Azul', '', '', '', ''] ] }
  ] }]);
  assert.equal(result.nectanet.partners[0].talent_names, 'Jean');
  assert.equal(result.nectanet.partners[0].areas, 'Redes');
  assert.equal(result.nectanet.partners[0].german, 'B1');
  assert.equal(result.nectanet.partners[0].english, 'B2');
});
