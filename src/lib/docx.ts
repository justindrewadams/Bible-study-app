/**
 * Writes an ExportDoc as a Word document (.docx), on the device, with no library: a .docx is a zip of a few
 * XML files. Headings use Word's own Heading styles (so the navigation pane and outline work), lists are real
 * Word lists, and links are real links. Opens in Word, Pages, LibreOffice, and Google Docs (by uploading).
 */
import type { Block, ExportDoc, Run } from './exportDoc';
import { readUrl } from './exportDoc';
import { spanLabel } from './refs';

const esc = (s: string) =>
  s
    // characters XML can't hold
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

class Writer {
  links: string[] = [];
  /** one numbering instance per numbered list, so each starts at 1 */
  numbered = 0;
  body: string[] = [];

  linkId(href: string) {
    let i = this.links.indexOf(href);
    if (i < 0) i = this.links.push(href) - 1;
    return `rLink${i + 1}`;
  }

  runs(runs: Run[], extra = ''): string {
    return runs
      .map((r) => {
        const props = `${r.b ? '<w:b/>' : ''}${r.i ? '<w:i/>' : ''}${extra}`;
        const br = r.br ? '<w:r><w:br/></w:r>' : '';
        const t = `<w:t xml:space="preserve">${esc(r.text)}</w:t>`;
        if (r.href) {
          return `${br}<w:hyperlink r:id="${this.linkId(r.href)}" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/>${props}</w:rPr>${t}</w:r></w:hyperlink>`;
        }
        return `${br}<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}${t}</w:r>`;
      })
      .join('');
  }

  para(style: string | null, content: string, extraPPr = '') {
    const ppr = style || extraPPr ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extraPPr}</w:pPr>` : '';
    this.body.push(`<w:p>${ppr}${content}</w:p>`);
  }

  block(b: Block) {
    switch (b.t) {
      case 'h':
        return this.para(`Heading${b.level}`, this.runs(b.runs));
      case 'p':
        return this.para(b.muted ? 'Meta' : null, this.runs(b.runs));
      case 'quote':
        return this.para('Quote', this.runs(b.runs));
      case 'list': {
        const num = b.ordered ? 2 + this.numbered++ : 1;
        for (const item of b.items) this.para('ListParagraph', this.runs(item), `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${num}"/></w:numPr>`);
        return;
      }
      case 'passage': {
        const label = spanLabel(b.span);
        if (!b.hideRef) this.para('Passage', this.runs([{ text: label, href: readUrl(b.span), b: true }]));
        if (b.verses?.length) {
          let lastChapter = b.span.chapter;
          const parts = b.verses.map((v) => {
            // a new chapter inside the passage shows as "2:1"
            const num = v.chapter !== lastChapter ? `${v.chapter}:${v.verse}` : `${v.verse}`;
            lastChapter = v.chapter;
            return `<w:r><w:rPr><w:color w:val="777777"/><w:vertAlign w:val="superscript"/></w:rPr><w:t xml:space="preserve">${num} </w:t></w:r><w:r><w:t xml:space="preserve">${esc(v.text)} </w:t></w:r>`;
          });
          this.para('VerseText', parts.join('') + (b.code ? `<w:r><w:t xml:space="preserve">(${esc(b.code)})</w:t></w:r>` : ''));
        }
        return;
      }
    }
  }
}

function documentXml(doc: ExportDoc, w: Writer): string {
  w.para('Title', w.runs([{ text: doc.title }]));
  if (doc.subtitle) w.para('Subtitle', w.runs([{ text: doc.subtitle }]));
  for (const b of doc.blocks) w.block(b);
  if (doc.credits.length) {
    w.para('Meta', '');
    for (const c of doc.credits) w.para('Credit', w.runs([{ text: c.text, href: c.href }]));
  }
  const made = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  w.para('Credit', w.runs([{ text: `Made with Ancient Pathfinder on ${made}. ` }, { text: 'ancientpathfinder.com', href: 'https://ancientpathfinder.com/' }]));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${w.body.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"/><w:sz w:val="23"/><w:szCs w:val="23"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:color w:val="1F2A44"/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:color w:val="666666"/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="100"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="1F2A44"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="1F2A44"/><w:sz w:val="27"/><w:szCs w:val="27"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="180" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Meta"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:color w:val="666666"/><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Passage"><w:name w:val="Passage"/><w:basedOn w:val="Normal"/><w:next w:val="VerseText"/><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="40"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="VerseText"><w:name w:val="Verse text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="160"/><w:ind w:left="360"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="BBBBBB"/></w:pBdr><w:ind w:left="360"/></w:pPr><w:rPr><w:i/><w:color w:val="444444"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Credit"><w:name w:val="Credit"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:color w:val="666666"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="1A5FB4"/><w:u w:val="single"/></w:rPr></w:style>
</w:styles>`;

function numberingXml(numbered: number): string {
  const lvl = (fmt: string, text: string, font = '') =>
    `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>${font}</w:lvl>`;
  const nums = [`<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>`];
  for (let i = 0; i < Math.max(1, numbered); i++)
    nums.push(`<w:num w:numId="${2 + i}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/>${lvl('bullet', '•', '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr>')}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/>${lvl('decimal', '%1.')}</w:abstractNum>${nums.join('')}</w:numbering>`;
}

function relsXml(links: string[]): string {
  const rel = (id: string, type: string, target: string, external = false) =>
    `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${esc(target)}"${external ? ' TargetMode="External"' : ''}/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rStyles', 'styles', 'styles.xml')}${rel('rNumbering', 'numbering', 'numbering.xml')}${links
    .map((l, i) => rel(`rLink${i + 1}`, 'hyperlink', l, true))
    .join('')}</Relationships>`;
}

function coreXml(title: string): string {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>Ancient Pathfinder</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

// ------------------------------------------------------------------------------ a plain zip file

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A zip with its files stored uncompressed (small documents; every reader accepts it). */
export function zip(files: { name: string; data: string }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.data);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // names are UTF-8
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, time, true);
    c.setUint16(14, date, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((a, p) => a + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/** The .docx file for a document. */
export function toDocx(doc: ExportDoc): Blob {
  const w = new Writer();
  const document = documentXml(doc, w);
  return zip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'docProps/core.xml', data: coreXml(doc.title) },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: STYLES },
    { name: 'word/numbering.xml', data: numberingXml(w.numbered) },
    { name: 'word/_rels/document.xml.rels', data: relsXml(w.links) },
  ]);
}
