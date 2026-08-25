const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Hard-coded source metadata — reliability/priority known in advance from the
// actual policy doc's stated precedence rules (contract > current policy > product doc).
// Lower priority number = higher authority. Deprecated docs are never authoritative.
const DOCUMENT_REGISTRY = [
  { file: '05_Northstar_Logistics_Enterprise_Agreement.pdf', type: 'contract', priority: 1, account_id: 'ACCT-001', status: 'current' },
  { file: '06_LumenWorks_Service_Agreement.pdf', type: 'contract', priority: 1, account_id: 'ACCT-002', status: 'current' },
  { file: '01_Support_Policy_v3_CURRENT.pdf', type: 'policy', priority: 2, account_id: null, status: 'current' },
  { file: '03_Cancellation_and_Service_Credit_SOP_v4.pdf', type: 'policy', priority: 2, account_id: null, status: 'current' },
  { file: '04_Product_Operations_Guide_and_Known_Issues.pdf', type: 'product_doc', priority: 3, account_id: null, status: 'current' },
  { file: '02_Support_Policy_v2_DEPRECATED.pdf', type: 'policy', priority: 99, account_id: null, status: 'deprecated' },
];

// Simple paragraph-based chunking: split on blank lines / numbered sections.
function chunkText(text, sourceMeta) {
  const cleaned = text.replace(/\r/g, '').trim();
  const rawChunks = cleaned.split(/\n(?=\d+\.\s)|\n{2,}/)
    .map(c => c.trim())
    .filter(Boolean)
    .filter(c => !/^--\s*\d+\s*of\s*\d+\s*--$/i.test(c)); // drop page-marker artifacts

  return rawChunks.map((chunk, i) => ({
    id: `${sourceMeta.file}::chunk${i}`,
    text: chunk,
    source_file: sourceMeta.file,
    doc_type: sourceMeta.type,
    priority: sourceMeta.priority,
    account_id: sourceMeta.account_id,
    status: sourceMeta.status,
  }));
}

async function buildDocumentIndex() {
  const allChunks = [];
  for (const meta of DOCUMENT_REGISTRY) {
    const filePath = path.join(DATA_DIR, meta.file);
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    const chunks = chunkText(parsed.text, meta);
    allChunks.push(...chunks);
  }
  return allChunks;
}

module.exports = { buildDocumentIndex, DOCUMENT_REGISTRY };

if (require.main === module) {
  buildDocumentIndex().then((chunks) => {
    console.log(`Total chunks: ${chunks.length}`);
    for (const c of chunks) {
      console.log(`\n--- ${c.id} [${c.doc_type}, priority ${c.priority}, status ${c.status}] ---`);
      console.log(c.text.slice(0, 100).replace(/\n/g, ' ') + '...');
    }
  });
}