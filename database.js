const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'ramza-pos.db');
const db = new Database(dbPath);

function initializeDatabase() {
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Bike', 'Scooty')),
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      stock_qty INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      total_amount REAL NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_name TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL
    );
  `);
}

function getDashboardMetrics() {
  const today = new Date().toISOString().slice(0, 10);

  const todaySales = db
    .prepare(`SELECT COALESCE(SUM(total_amount), 0) AS value FROM sales WHERE date = ?`)
    .get(today).value;

  const totalSalesRevenue = db
    .prepare(`SELECT COALESCE(SUM(total_amount), 0) AS value FROM sales`)
    .get().value;

  const totalCogs = db
    .prepare(`
      SELECT COALESCE(SUM(si.quantity * p.purchase_price), 0) AS value
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
    `)
    .get().value;

  const totalExpenses = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS value FROM expenses`)
    .get().value;

  const currentProfit = totalSalesRevenue - totalCogs - totalExpenses;

  const stockValue = db
    .prepare(`SELECT COALESCE(SUM(stock_qty * purchase_price), 0) AS value FROM products`)
    .get().value;

  return {
    todaySales,
    totalSalesRevenue,
    totalCogs,
    totalExpenses,
    currentProfit,
    stockValue,
  };
}

module.exports = {
  db,
  initializeDatabase,
  getDashboardMetrics,
};
