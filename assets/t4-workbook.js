/* Talents 4 · leitor e gerador OOXML mínimo para os dois modelos oficiais.
   O módulo é local, sem rede, sem macros e sem persistência de arquivos.
   Ele lê planilhas do Excel por meio do JSZip local e materializa os valores
   exibidos; nenhuma fórmula ou macro é executada no navegador. */
(function (global) {
  'use strict';

  const XMLNS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const RELNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const RELPKG = 'http://schemas.openxmlformats.org/package/2006/relationships';

  function xmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function xmlDecode(value) {
    return String(value ?? '')
      .replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  function tagPrefix(name) {
    return `(?:[A-Za-z_][\\w.-]*:)?${name}`;
  }

  function attribute(attrs, name) {
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = String(attrs || '').match(new RegExp(`(?:^|\\s)${safe}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
    return xmlDecode(match?.[1] ?? match?.[2] ?? '');
  }

  function blocks(xml, name) {
    const prefix = tagPrefix(name);
    return [...String(xml || '').matchAll(new RegExp(`<${prefix}\\b[^>]*>([\\s\\S]*?)</${prefix}>`, 'gi'))].map((match) => match[1]);
  }

  function openingTags(xml, name) {
    const prefix = tagPrefix(name);
    return [...String(xml || '').matchAll(new RegExp(`<(${prefix})\\b([^>]*)>`, 'gi'))].map((match) => ({ attrs: match[2], full: match[0] }));
  }

  function firstBlock(xml, name) {
    return blocks(xml, name)[0] || '';
  }

  function textValue(xml) {
    const pieces = blocks(xml, 't');
    if (pieces.length) return pieces.map(xmlDecode).join('');
    return xmlDecode(String(xml || '').replace(/<[^>]+>/g, ''));
  }

  function normalizePath(path) {
    const parts = String(path || '').replace(/^\/+/, '').split('/');
    const result = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') result.pop(); else result.push(part);
    }
    return result.join('/');
  }

  function relationshipTarget(target) {
    const value = String(target || '').replace(/^\/+/, '');
    return normalizePath(value.startsWith('xl/') ? value : `xl/${value}`);
  }

  function columnNumber(reference) {
    const letters = String(reference || '').match(/[A-Z]+/i)?.[0]?.toUpperCase() || 'A';
    let result = 0;
    for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
    return result;
  }

  function columnName(number) {
    let value = Math.max(1, Number(number) || 1), result = '';
    while (value) {
      const remainder = (value - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      value = Math.floor((value - 1) / 26);
    }
    return result;
  }

  function asValue(raw, type, sharedStrings) {
    if (type === 'inlineStr') return textValue(firstBlock(raw, 'is') || raw);
    const value = type === 'str' ? textValue(raw) : xmlDecode(firstBlock(raw, 'v'));
    if (!value) return '';
    if (type === 's') return sharedStrings[Number(value)] ?? '';
    if (type === 'b') return value === '1' || /^true$/i.test(value);
    if (type === 'n' || !type) {
      const number = Number(value);
      if (Number.isFinite(number) && /^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(value)) return number;
    }
    return value;
  }

  function parseSharedStrings(xml) {
    return blocks(xml, 'si').map((item) => textValue(item));
  }

  function parseSheet(xml, sharedStrings) {
    const rows = [];
    const formulas = [];
    for (const rowMatch of String(xml || '').matchAll(new RegExp(`<${tagPrefix('row')}\\b([^>]*)>([\\s\\S]*?)</${tagPrefix('row')}>`, 'gi'))) {
      const rowAttrs = rowMatch[1], rowXml = rowMatch[2];
      const rowNumber = Number(attribute(rowAttrs, 'r')) || rows.length + 1;
      while (rows.length < rowNumber) rows.push([]);
      const row = rows[rowNumber - 1];
      // O OOXML omite o conteúdo de uma célula vazia e a serializa como
      // <c r="F3"/>. Um segundo regex que procurava apenas células com
      // fechamento </c> acabava consumindo a célula vazia junto com a
      // seguinte e deslocava todos os valores para a esquerda. Isso
      // transformava idades, códigos e observações em nomes de empresas.
      // Um único tokenizador trata as duas formas e sempre usa a referência
      // explícita da célula como posição da coluna.
      const cellPattern = new RegExp(`<${tagPrefix('c')}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)</${tagPrefix('c')}>)`, 'gi');
      for (const cellMatch of rowXml.matchAll(cellPattern)) {
        const attrs = cellMatch[1], body = cellMatch[2] || '', reference = attribute(attrs, 'r') || `${columnName(row.length + 1)}${rowNumber}`;
        const index = Math.max(0, columnNumber(reference) - 1);
        const type = attribute(attrs, 't');
        row[index] = asValue(body, type, sharedStrings);
        const formula = textValue(firstBlock(body, 'f'));
        if (formula) formulas.push({ reference, formula });
      }
    }
    while (rows.length && !rows.at(-1).some((value) => value !== undefined && value !== '')) rows.pop();
    return { rows: rows.map((row) => row.map((value) => value ?? '')), formulas };
  }

  async function zipText(zip, path) {
    const file = zip.file(path);
    return file ? file.async('string') : '';
  }

  async function read(file) {
    const JSZip = global.JSZip || globalThis.JSZip;
    if (!JSZip) throw new Error('Leitor de planilhas indisponível. Atualize a página da homologação.');
    const input = typeof file?.arrayBuffer === 'function' ? await file.arrayBuffer() : file;
    const zip = await JSZip.loadAsync(input);
    const workbookXml = await zipText(zip, 'xl/workbook.xml');
    if (!workbookXml) throw new Error('O arquivo não contém um livro Excel válido.');
    const relXml = await zipText(zip, 'xl/_rels/workbook.xml.rels');
    const relationships = new Map(openingTags(relXml, 'Relationship').map(({ attrs }) => [attribute(attrs, 'Id'), relationshipTarget(attribute(attrs, 'Target'))]));
    const sharedStrings = parseSharedStrings(await zipText(zip, 'xl/sharedStrings.xml'));
    const sheets = [];
    for (const { attrs } of openingTags(firstBlock(workbookXml, 'sheets'), 'sheet')) {
      const name = attribute(attrs, 'name'), relId = attribute(attrs, 'id') || attribute(attrs, 'r:id');
      const path = relationships.get(relId) || `xl/worksheets/sheet${sheets.length + 1}.xml`;
      const xml = await zipText(zip, path);
      if (!xml) continue;
      const parsed = parseSheet(xml, sharedStrings);
      sheets.push({ name, path, ...parsed });
    }
    if (!sheets.length) throw new Error('O arquivo não contém abas legíveis.');
    return { name: file?.name || 'planilha', sheets, sharedStrings, sourceType: /\.xlsm$/i.test(file?.name || '') ? 'xlsm' : 'xlsx' };
  }

  async function readMany(files) {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) throw new Error('Selecione pelo menos uma planilha Excel.');
    return Promise.all(list.map(read));
  }

  function styleXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${XMLNS}">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
  <fonts count="3"><font><sz val="10"/><color rgb="FF21445F"/><name val="Aptos"/></font><font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts>
  <fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF002A4A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F0F7"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFB3C4D0"/></left><right style="thin"><color rgb="FFB3C4D0"/></right><top style="thin"><color rgb="FFB3C4D0"/></top><bottom style="thin"><color rgb="FFB3C4D0"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="right" vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  }

  function primitive(value) {
    if (value && typeof value === 'object' && 'value' in value) return value.value;
    return value;
  }

  function cellXml(row, col, value, style) {
    const ref = `${columnName(col)}${row}`;
    if (value && typeof value === 'object' && value.formula) {
      const cached = primitive(value.value);
      return `<c r="${ref}" s="${style}"><f>${xmlEscape(value.formula)}</f>${cached == null || cached === '' ? '' : `<v>${xmlEscape(cached)}</v>`}</c>`;
    }
    const current = primitive(value);
    if (current == null || current === '') return '';
    if (typeof current === 'number' && Number.isFinite(current)) return `<c r="${ref}" s="${style}"><v>${String(current)}</v></c>`;
    if (typeof current === 'boolean') return `<c r="${ref}" s="${style}" t="b"><v>${current ? '1' : '0'}</v></c>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(current)}</t></is></c>`;
  }

  function mergeRange(range) {
    if (typeof range === 'string') return range;
    return `${columnName(range.from[1] || range.from.col || 1)}${range.from[0] || range.from.row || 1}:${columnName(range.to[1] || range.to.col || 1)}${range.to[0] || range.to.row || 1}`;
  }

  function writeSheet(spec, index) {
    const rows = Array.isArray(spec.rows) ? spec.rows : [];
    const maxColumns = Math.max(1, spec.widths?.length || 0, ...rows.map((row) => Array.isArray(row) ? row.length : 0));
    const maxRow = Math.max(1, rows.length, ...(spec.merges || []).map((merge) => Number(String(mergeRange(merge).match(/:(?:[A-Z]+)(\d+)$/)?.[1] || 1))));
    const headerRow = spec.headerRow || 0;
    const rowXml = rows.map((row, rowIndex) => {
      const values = Array.isArray(row) ? row : [];
      const cells = values.map((value, colIndex) => {
        if (value == null || value === '') return '';
        let style = rowIndex < (spec.titleRows || 0) ? 1 : rowIndex === headerRow - 1 ? 3 : 4;
        if (spec.cellStyle) style = spec.cellStyle(value, rowIndex + 1, colIndex + 1, style) ?? style;
        return cellXml(rowIndex + 1, colIndex + 1, value, style);
      }).join('');
      const height = spec.rowHeights?.[rowIndex] || (rowIndex < (spec.titleRows || 0) ? 24 : rowIndex === headerRow - 1 ? 32 : undefined);
      return `<row r="${rowIndex + 1}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells}</row>`;
    }).join('');
    const cols = (spec.widths || []).map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Number(width) || 12}" customWidth="1"/>`).join('');
    const merges = (spec.merges || []).map((merge) => `<mergeCell ref="${xmlEscape(mergeRange(merge))}"/>`).join('');
    const filter = headerRow ? `<autoFilter ref="A${headerRow}:${columnName(maxColumns)}${maxRow}"/>` : '';
    const breaks = (spec.pageBreaks || []).filter((value) => Number(value) > 0 && Number(value) < maxRow).map((value) => `<brk id="${Number(value)}" max="16383" man="1"/>`).join('');
    const pane = spec.freezeRows ? `<pane ySplit="${spec.freezeRows}" topLeftCell="A${spec.freezeRows + 1}" activePane="bottomLeft" state="frozen"/>` : '';
    const view = `<sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews>`;
    const print = `<printOptions horizontalCentered="0" verticalCentered="0"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup orientation="${spec.orientation || 'landscape'}" fitToWidth="1" fitToHeight="0" paperSize="9"/>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${XMLNS}" xmlns:r="${RELNS}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${columnName(maxColumns)}${maxRow}"/>${view}<sheetFormatPr defaultRowHeight="18"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${rowXml}</sheetData>${filter}${merges ? `<mergeCells count="${(spec.merges || []).length}">${merges}</mergeCells>` : ''}${print}${breaks ? `<rowBreaks count="${(spec.pageBreaks || []).length}" manualBreakCount="${(spec.pageBreaks || []).length}">${breaks}</rowBreaks>` : ''}</worksheet>`;
  }

  function safeSheetName(name, used = new Set()) {
    const base = String(name || 'Aba').replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || 'Aba';
    let result = base, index = 2;
    while (used.has(result)) result = `${base.slice(0, Math.max(1, 31 - String(index).length - 1))} ${index++}`;
    used.add(result); return result;
  }

  async function write(workbook) {
    const JSZip = global.JSZip || globalThis.JSZip;
    if (!JSZip) throw new Error('Gerador de planilhas indisponível. Atualize a página da homologação.');
    const zip = new JSZip(), specs = Array.isArray(workbook?.sheets) ? workbook.sheets : [];
    if (!specs.length) throw new Error('Não há abas para exportar.');
    const used = new Set(), sheetNames = specs.map((spec) => safeSheetName(spec.name, used));
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${specs.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${RELPKG}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${RELPKG}">${specs.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${specs.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.file('xl/styles.xml', styleXml());
    zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${XMLNS}" xmlns:r="${RELNS}"><fileVersion appName="Talents 4"/><workbookPr defaultThemeVersion="164011"/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="18000" windowHeight="12000"/></bookViews><sheets>${sheetNames.map((name, i) => `<sheet name="${xmlEscape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`);
    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Talents 4</dc:creator><cp:lastModifiedBy>Talents 4</cp:lastModifiedBy><dc:title>Exportação Talents 4</dc:title><dc:description>Arquivo gerado pela homologação Talents 4, sem macros.</dc:description></cp:coreProperties>`);
    zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Talents 4</Application><AppVersion>4.0</AppVersion><HeadingPairs><vt:vector xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes" size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${specs.length}</vt:i4></vt:variant></vt:vector></HeadingPairs></Properties>`);
    specs.forEach((spec, index) => zip.file(`xl/worksheets/sheet${index + 1}.xml`, writeSheet({ ...spec, name: sheetNames[index] }, index)));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  global.T4Workbook = Object.freeze({ read, readMany, write, columnName, columnNumber, normalizePath });
  if (typeof module !== 'undefined' && module.exports) module.exports = global.T4Workbook;
})(typeof window === 'undefined' ? globalThis : window);
