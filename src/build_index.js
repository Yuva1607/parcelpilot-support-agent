const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const DATA_DIR = path.join(__dirname, '..', 'data');

const DOCUMENT_REGISTRY = [
  {
    file: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
    type: 'contract',
    priority: 1,
    account_id: 'ACCT-001',
    status: 'current'
  },
  {
    file: '06_LumenWorks_Service_Agreement.pdf',
    type: 'contract',
    priority: 1,
    account_id: 'ACCT-002',
    status: 'current'
  },
  {
    file: '01_Support_Policy_v3_CURRENT.pdf',
    type: 'policy',
    priority: 2,
    account_id: null,
    status: 'current'
  },
  {
    file: '03_Cancellation_and_Service_Credit_SOP_v4.pdf',
    type: 'policy',
    priority: 2,
    account_id: null,
    status: 'current'
  },
  {
    file: '04_Product_Operations_Guide_and_Known_Issues.pdf',
    type: 'product_doc',
    priority: 3,
    account_id: null,
    status: 'current'
  },
  {
    file: '02_Support_Policy_v2_DEPRECATED.pdf',
    type: 'policy',
    priority: 99,
    account_id: null,
    status: 'deprecated'
  }
];

function chunkText(text, sourceMeta) {
  const cleaned = text.replace(/\r/g, '').trim();

  const rawChunks = cleaned
    .split(/\n(?=\d+\.\s)|\n{2,}/)
    .map(c => c.trim())
    .filter(Boolean)
    .filter(c => !/^--\s*\d+\s*of\s*\d+\s*--$/i.test(c));

  return rawChunks.map((chunk, i) => ({
    id: `${sourceMeta.file}::chunk${i}`,
    text: chunk,
    source_file: sourceMeta.file,
    doc_type: sourceMeta.type,
    priority: sourceMeta.priority,
    account_id: sourceMeta.account_id,
    status: sourceMeta.status
  }));
}

async function main() {
  const allChunks = [];

  for (const meta of DOCUMENT_REGISTRY) {
    console.log(`Parsing ${meta.file}...`);

    const filePath = path.join(DATA_DIR, meta.file);
    const buffer = fs.readFileSync(filePath);

    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();

    const chunks = chunkText(parsed.text, meta);

    allChunks.push(...chunks);
  }

  const outputPath = path.join(DATA_DIR, 'document_index.json');

  fs.writeFileSync(
    outputPath,
    JSON.stringify(allChunks, null, 2)
  );

  console.log(`\nCreated ${outputPath}`);
  console.log(`Total chunks: ${allChunks.length}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});