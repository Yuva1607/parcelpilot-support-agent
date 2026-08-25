const { getDb } = require('./db');

function createEscalation(
  { accountId, orderId = null, ticketId = null, reason, priority = 'P2' },
  { role }
) {
  if (!['agent', 'manager'].includes(role)) {
    throw new Error('Unauthorised role');
  }

  if (!accountId) {
    throw new Error('accountId is required');
  }

  if (!reason || typeof reason !== 'string') {
    throw new Error('A valid escalation reason is required');
  }

  const db = getDb();

  try {
    const account = db
      .prepare('SELECT * FROM accounts WHERE account_id = ?')
      .get(accountId);

    if (!account) {
      throw new Error('Account not found');
    }

    const timestamp = new Date().toISOString();

    const escalation = {
      escalation_id: `ESC-${Date.now()}`,
      account_id: accountId,
      order_id: orderId,
      ticket_id: ticketId,
      reason,
      priority,
      status: 'open',
      created_at: timestamp
    };

    return {
      success: true,
      message: 'Escalation created successfully',
      escalation
    };
  } finally {
    db.close();
  }
}

module.exports = { createEscalation };

if (require.main === module) {
  console.log('--- Create escalation test ---');

  console.log(
    createEscalation(
      {
        accountId: 'ACCT-001',
        orderId: 'ORD-1001',
        reason: 'Customer disputes cancellation fee',
        priority: 'P1'
      },
      { role: 'agent' }
    )
  );

  console.log('\n--- Invalid role test ---');

  try {
    createEscalation(
      {
        accountId: 'ACCT-001',
        reason: 'Test escalation'
      },
      { role: 'random_role' }
    );
  } catch (error) {
    console.log('Correctly blocked:', error.message);
  }
}
