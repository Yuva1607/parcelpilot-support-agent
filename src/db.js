const path = require('path');
const fs = require('fs');
const os = require('os');
const xlsx = require('xlsx');
const Database = require('better-sqlite3');

const DATA_XLSX = path.join(
  __dirname,
  '..',
  'data',
  'ParcelPilot_Assessment_Data.xlsx'
);

const IS_VERCEL = Boolean(process.env.VERCEL);

const DB_PATH = IS_VERCEL
  ? path.join(os.tmpdir(), 'parcelpilot.db')
  : path.join(__dirname, '..', 'data', 'parcelpilot.db');

let initialized = false;

function loadDatabase() {
  const db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');

  db.exec(`
    DROP TABLE IF EXISTS accounts;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS tickets;
    DROP TABLE IF EXISTS meta;

    CREATE TABLE accounts (
      account_id TEXT PRIMARY KEY,
      account_name TEXT,
      plan TEXT,
      status TEXT,
      csm TEXT,
      contract_file TEXT,
      premium_support INTEGER,
      notes TEXT
    );

    CREATE TABLE orders (
      order_id TEXT PRIMARY KEY,
      account_id TEXT,
      carrier TEXT,
      status TEXT,
      booked_at TEXT,
      pickup_window_start TEXT,
      pickup_window_end TEXT,
      pickup_actual_at TEXT,
      shipment_fee_inr REAL,
      carrier_fault INTEGER,
      customer_fault INTEGER,
      cancellation_requested_at TEXT,
      notes TEXT
    );

    CREATE TABLE tickets (
      ticket_id TEXT PRIMARY KEY,
      account_id TEXT,
      created_at TEXT,
      status TEXT,
      subject TEXT,
      description TEXT,
      channel TEXT,
      assigned_to TEXT,
      last_customer_message_at TEXT,
      historical_resolution TEXT
    );

    CREATE TABLE meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const wb = xlsx.readFile(DATA_XLSX, { cellDates: false });

  const insertMeta = db.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?)'
  );

  for (const row of xlsx.utils.sheet_to_json(
    wb.Sheets['README'],
    { header: 1 }
  )) {
    if (row[0] && row[1] !== undefined) {
      insertMeta.run(String(row[0]), String(row[1]));
    }
  }

  const insertAccount = db.prepare(`
    INSERT INTO accounts (
      account_id,
      account_name,
      plan,
      status,
      csm,
      contract_file,
      premium_support,
      notes
    )
    VALUES (
      @account_id,
      @account_name,
      @plan,
      @status,
      @csm,
      @contract_file,
      @premium_support,
      @notes
    )
  `);

  for (const row of xlsx.utils.sheet_to_json(wb.Sheets['accounts'])) {
    insertAccount.run({
      account_id: row.account_id ?? null,
      account_name: row.account_name ?? null,
      plan: row.plan ?? null,
      status: row.status ?? null,
      csm: row.csm ?? null,
      contract_file: row.contract_file ?? null,
      premium_support: row.premium_support ? 1 : 0,
      notes: row.notes ?? null
    });
  }

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      order_id,
      account_id,
      carrier,
      status,
      booked_at,
      pickup_window_start,
      pickup_window_end,
      pickup_actual_at,
      shipment_fee_inr,
      carrier_fault,
      customer_fault,
      cancellation_requested_at,
      notes
    )
    VALUES (
      @order_id,
      @account_id,
      @carrier,
      @status,
      @booked_at,
      @pickup_window_start,
      @pickup_window_end,
      @pickup_actual_at,
      @shipment_fee_inr,
      @carrier_fault,
      @customer_fault,
      @cancellation_requested_at,
      @notes
    )
  `);

  for (const row of xlsx.utils.sheet_to_json(wb.Sheets['orders'])) {
    insertOrder.run({
      order_id: row.order_id ?? null,
      account_id: row.account_id ?? null,
      carrier: row.carrier ?? null,
      status: row.status ?? null,
      booked_at: row.booked_at ?? null,
      pickup_window_start: row.pickup_window_start ?? null,
      pickup_window_end: row.pickup_window_end ?? null,
      pickup_actual_at: row.pickup_actual_at ?? null,
      shipment_fee_inr: row.shipment_fee_inr ?? null,
      carrier_fault: row.carrier_fault ? 1 : 0,
      customer_fault: row.customer_fault ? 1 : 0,
      cancellation_requested_at: row.cancellation_requested_at ?? null,
      notes: row.notes ?? null
    });
  }

  const insertTicket = db.prepare(`
    INSERT INTO tickets (
      ticket_id,
      account_id,
      created_at,
      status,
      subject,
      description,
      channel,
      assigned_to,
      last_customer_message_at,
      historical_resolution
    )
    VALUES (
      @ticket_id,
      @account_id,
      @created_at,
      @status,
      @subject,
      @description,
      @channel,
      @assigned_to,
      @last_customer_message_at,
      @historical_resolution
    )
  `);

  for (const row of xlsx.utils.sheet_to_json(wb.Sheets['tickets'])) {
    insertTicket.run({
      ticket_id: row.ticket_id ?? null,
      account_id: row.account_id ?? null,
      created_at: row.created_at ?? null,
      status: row.status ?? null,
      subject: row.subject ?? null,
      description: row.description ?? null,
      channel: row.channel ?? null,
      assigned_to: row.assigned_to ?? null,
      last_customer_message_at: row.last_customer_message_at ?? null,
      historical_resolution: row.historical_resolution ?? null
    });
  }

  console.log(
    'Loaded',
    xlsx.utils.sheet_to_json(wb.Sheets['accounts']).length,
    'accounts,',
    xlsx.utils.sheet_to_json(wb.Sheets['orders']).length,
    'orders,',
    xlsx.utils.sheet_to_json(wb.Sheets['tickets']).length,
    'tickets.'
  );

  db.close();
  initialized = true;
}

function ensureDatabase() {
  if (initialized && fs.existsSync(DB_PATH)) {
    return;
  }

  // On Vercel, create the writable /tmp database from the Excel source.
  if (!fs.existsSync(DB_PATH)) {
    loadDatabase();
  } else {
    initialized = true;
  }
}

function getDb() {
  ensureDatabase();

  return new Database(DB_PATH, {
    readonly: false
  });
}

if (require.main === module) {
  loadDatabase();
}

module.exports = {
  loadDatabase,
  getDb,
  DB_PATH
};