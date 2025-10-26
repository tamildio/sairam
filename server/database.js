import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const db = new Database(path.join(dataDir, 'rent_receipts.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create rent_receipts table
const createTableSQL = `
CREATE TABLE IF NOT EXISTS rent_receipts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  receipt_date TEXT NOT NULL,
  tenant_name TEXT NOT NULL,
  eb_reading_last_month REAL NOT NULL,
  eb_reading_this_month REAL NOT NULL,
  eb_rate_per_unit REAL NOT NULL,
  units_consumed REAL NOT NULL,
  eb_charges REAL NOT NULL,
  rent_amount REAL NOT NULL,
  total_amount REAL NOT NULL,
  received_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

db.exec(createTableSQL);

// Create index for faster queries
db.exec(`
CREATE INDEX IF NOT EXISTS idx_rent_receipts_created_at 
ON rent_receipts(created_at DESC);
`);

// Create index for tenant filtering
db.exec(`
CREATE INDEX IF NOT EXISTS idx_rent_receipts_tenant_name 
ON rent_receipts(tenant_name);
`);

// Prepare statements for better performance
const statements = {
  insert: db.prepare(`
    INSERT INTO rent_receipts (
      id, receipt_date, tenant_name, eb_reading_last_month, 
      eb_reading_this_month, eb_rate_per_unit, units_consumed, 
      eb_charges, rent_amount, total_amount, received_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  selectAll: db.prepare(`
    SELECT * FROM rent_receipts 
    ORDER BY created_at DESC
  `),
  
  selectById: db.prepare(`
    SELECT * FROM rent_receipts WHERE id = ?
  `),
  
  selectByTenant: db.prepare(`
    SELECT * FROM rent_receipts 
    WHERE tenant_name = ? 
    ORDER BY created_at DESC
  `),
  
  selectWithLimit: db.prepare(`
    SELECT * FROM rent_receipts 
    ORDER BY created_at DESC 
    LIMIT ?
  `),
  
  selectByTenantWithLimit: db.prepare(`
    SELECT * FROM rent_receipts 
    WHERE tenant_name = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `),
  
  update: db.prepare(`
    UPDATE rent_receipts 
    SET receipt_date = ?, tenant_name = ?, eb_reading_last_month = ?, 
        eb_reading_this_month = ?, eb_rate_per_unit = ?, units_consumed = ?, 
        eb_charges = ?, rent_amount = ?, total_amount = ?, received_date = ?
    WHERE id = ?
  `),
  
  delete: db.prepare(`
    DELETE FROM rent_receipts WHERE id = ?
  `)
};

// Database operations
const dbOperations = {
  // Insert a new receipt
  insertReceipt: (receipt) => {
    // Generate a UUID for the receipt
    const id = randomUUID();
    
    const result = statements.insert.run(
      id,
      receipt.receipt_date,
      receipt.tenant_name,
      receipt.eb_reading_last_month,
      receipt.eb_reading_this_month,
      receipt.eb_rate_per_unit,
      receipt.units_consumed,
      receipt.eb_charges,
      receipt.rent_amount,
      receipt.total_amount,
      receipt.received_date || null
    );
    
    return statements.selectById.get(id);
  },

  // Get all receipts
  getAllReceipts: () => {
    return statements.selectAll.all();
  },

  // Get receipts with optional filters
  getReceipts: (options = {}) => {
    const { limit, tenant_name } = options;
    
    if (tenant_name && limit) {
      return statements.selectByTenantWithLimit.all(tenant_name, limit);
    } else if (tenant_name) {
      return statements.selectByTenant.all(tenant_name);
    } else if (limit) {
      return statements.selectWithLimit.all(limit);
    } else {
      return statements.selectAll.all();
    }
  },

  // Update a receipt
  updateReceipt: (id, updates) => {
    const existing = statements.selectById.get(id);
    if (!existing) {
      throw new Error('Receipt not found');
    }

    const updated = { ...existing, ...updates };
    statements.update.run(
      updated.receipt_date,
      updated.tenant_name,
      updated.eb_reading_last_month,
      updated.eb_reading_this_month,
      updated.eb_rate_per_unit,
      updated.units_consumed,
      updated.eb_charges,
      updated.rent_amount,
      updated.total_amount,
      updated.received_date,
      id
    );

    return statements.selectById.get(id);
  },

  // Delete a receipt
  deleteReceipt: (id) => {
    const existing = statements.selectById.get(id);
    if (!existing) {
      throw new Error('Receipt not found');
    }

    statements.delete.run(id);
    return { success: true, deleted: existing };
  }
};

export { db, dbOperations };
