const { getDb } = require('./db');

const ROLES = ['agent', 'manager'];

function queryAccountData({ queryType, accountId, orderId, ticketId }, { role }) {
  if (!ROLES.includes(role)) {
    throw new Error('Unauthorised role');
  }

  const db = getDb();
  try {
    switch (queryType) {
      case 'get_account': {
        if (!accountId) throw new Error('accountId required for get_account');
        return db.prepare('SELECT * FROM accounts WHERE account_id = ?').get(accountId) || { error: 'Account not found' };
      }
      case 'get_order': {
        if (!orderId) throw new Error('orderId required for get_order');
        return db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId) || { error: 'Order not found' };
      }
      case 'list_orders_for_account': {
        if (!accountId) throw new Error('accountId required for list_orders_for_account');
        return db.prepare('SELECT * FROM orders WHERE account_id = ?').all(accountId);
      }
      case 'get_ticket': {
        if (!ticketId) throw new Error('ticketId required for get_ticket');
        return db.prepare('SELECT * FROM tickets WHERE ticket_id = ?').get(ticketId) || { error: 'Ticket not found' };
      }
      case 'list_tickets_for_account': {
        if (!accountId) throw new Error('accountId required for list_tickets_for_account');
        return db.prepare('SELECT * FROM tickets WHERE account_id = ?').all(accountId);
      }
      case 'list_open_tickets': {
        return db.prepare("SELECT * FROM tickets WHERE status != 'closed'").all();
      }
      case 'get_snapshot_time': {
        return db.prepare("SELECT value FROM meta WHERE key = 'Dataset snapshot'").get();
      }
      default:
        throw new Error(`Unknown queryType: ${queryType}`);
    }
  } finally {
    db.close();
  }
}

module.exports = { queryAccountData, ROLES };

if (require.main === module) {
  console.log('--- get_account ACCT-001 (agent) ---');
  console.log(queryAccountData({ queryType: 'get_account', accountId: 'ACCT-001' }, { role: 'agent' }));

  console.log('--- unauthorised role test ---');
  try {
    queryAccountData({ queryType: 'get_account', accountId: 'ACCT-001' }, { role: 'random_role' });
  } catch (e) {
    console.log('Correctly blocked:', e.message);
  }

  console.log('--- bad queryType test ---');
  try {
    queryAccountData({ queryType: 'DROP TABLE accounts' }, { role: 'agent' });
  } catch (e) {
    console.log('Correctly blocked:', e.message);
  }
}