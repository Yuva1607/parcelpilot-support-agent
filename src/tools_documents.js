const { buildDocumentIndex, searchDocuments } = require('./documents');

async function searchDocumentTool({ query, accountId, topK = 5 }) {
  if (!query || typeof query !== 'string') {
    throw new Error('A valid search query is required');
  }

  const chunks = await buildDocumentIndex();

  const results = searchDocuments(chunks, query, {
    accountId,
    topK
  });

  return results.map((result) => ({
    source_file: result.source_file,
    page: result.page,
    text: result.text,
    score: result.score,
    account_id: result.account_id || null,
    status: result.status
  }));
}

module.exports = { searchDocumentTool };

if (require.main === module) {
  searchDocumentTool({
    query: 'What is the cancellation fee?',
    accountId: 'ACCT-001'
  })
    .then((results) => {
      console.log('--- Document search results ---');
      console.log(results);
    })
    .catch((error) => {
      console.error('Error:', error.message);
    });
}