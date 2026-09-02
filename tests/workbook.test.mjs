import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.JSZip = (await import('../assets/jszip.min.js')).default;
await import('../assets/t4-workbook.js');

test('leitor preserva colunas depois de uma célula OOXML vazia', async () => {
  const zip = new globalThis.JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Teste" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>antes</t></is></c><c r="B1"/><c r="C1" t="inlineStr"><is><t>depois</t></is></c><c r="D1" t="inlineStr"><is><t>final</t></is></c></row></sheetData></worksheet>');
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const workbook = await globalThis.T4Workbook.read({ arrayBuffer: async () => buffer });
  assert.deepEqual(workbook.sheets[0].rows[0], ['antes', '', 'depois', 'final']);
});
