const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const INDEX_FILE = path.join(DATA_DIR, 'document_index.json');

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

/*
 * Production/runtime path:
 * Read the already-built document index instead of importing pdf-parse.
 *
 * This prevents pdf-parse's browser/canvas dependencies from crashing
 * the Vercel serverless runtime.
 */
async function buildDocumentIndex() {
  if (!fs.existsSync(INDEX_FILE)) {
    throw new Error(
      'Document index not found. Run "node src/build_index.js" before starting the application.'
    );
  }

  return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
}

/*
 * Small keyword-overlap search.
 *
 * Higher score = better match.
 * Account-specific contract chunks receive a strong boost.
 * Lower priority numbers are more authoritative.
 * Deprecated documents are heavily penalized.
 */
function searchDocuments(
  chunks,
  query,
  { accountId = null, topK = 5 } = {}
) {
  const queryWords = query.toLowerCase().match(/[a-z0-9]+/g) || [];

  const scored = chunks
    .map(chunk => {
      const chunkWords = chunk.text.toLowerCase();

      let matchCount = 0;

      for (const word of queryWords) {
        if (word.length > 2 && chunkWords.includes(word)) {
          matchCount++;
        }
      }

      if (matchCount === 0) {
        return null;
      }

      let score = matchCount * 10 - chunk.priority;

      if (accountId && chunk.account_id === accountId) {
        score += 15;
      }

      if (chunk.status === 'deprecated') {
        score -= 50;
      }

      return {
        ...chunk,
        score
      };
    })
    .filter(Boolean);

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

module.exports = {
  buildDocumentIndex,
  DOCUMENT_REGISTRY,
  searchDocuments
};

if (require.main === module) {
  buildDocumentIndex()
    .then(chunks => {
      console.log(`Total chunks: ${chunks.length}`);

      for (const chunk of chunks) {
        console.log(
          `\n--- ${chunk.id} [${chunk.doc_type}, priority ${chunk.priority}, status ${chunk.status}] ---`
        );
        console.log(
          chunk.text.slice(0, 100).replace(/\n/g, ' ') + '...'
        );
      }
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}