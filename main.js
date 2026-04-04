const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { db, initializeDatabase, getDashboardMetrics } = require('./database');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  initializeDatabase();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function registerIpcHandlers() {
  ipcMain.handle('products:getAll', (_event, search = '') => {
    if (search) {
      return db
        .prepare(`SELECT * FROM products WHERE name LIKE ? ORDER BY name ASC`)
        .all(`%${search}%`);
    }

    return db.prepare(`SELECT * FROM products ORDER BY id DESC`).all();
  });

  ipcMain.handle('products:create', (_event, payload) => {
    const stmt = db.prepare(`
      INSERT INTO products (name, category, purchase_price, selling_price, stock_qty)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      payload.name,
      payload.category,
      payload.purchase_price,
      payload.selling_price,
      payload.stock_qty
    );

    return { id: result.lastInsertRowid, ...payload };
  });

  ipcMain.handle('products:update', (_event, payload) => {
    db.prepare(`
      UPDATE products
      SET name = ?, category = ?, purchase_price = ?, selling_price = ?, stock_qty = ?
      WHERE id = ?
    `).run(
      payload.name,
      payload.category,
      payload.purchase_price,
      payload.selling_price,
      payload.stock_qty,
      payload.id
    );

    return { success: true };
  });

  ipcMain.handle('products:delete', (_event, productId) => {
    db.prepare(`DELETE FROM products WHERE id = ?`).run(productId);
    return { success: true };
  });

  ipcMain.handle('inventory:purchase', (_event, payload) => {
    db.prepare(`UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?`).run(
      payload.quantity,
      payload.product_id
    );

    return { success: true };
  });

  ipcMain.handle('customers:getAll', () => {
    return db.prepare(`SELECT * FROM customers ORDER BY id DESC`).all();
  });

  ipcMain.handle('customers:create', (_event, payload) => {
    const result = db
      .prepare(`INSERT INTO customers (name, phone) VALUES (?, ?)`)
      .run(payload.name, payload.phone || null);

    return { id: result.lastInsertRowid, ...payload };
  });

  ipcMain.handle('expenses:getAll', () => {
    return db.prepare(`SELECT * FROM expenses ORDER BY date DESC, id DESC`).all();
  });

  ipcMain.handle('expenses:create', (_event, payload) => {
    const result = db
      .prepare(`INSERT INTO expenses (description, amount, category, date) VALUES (?, ?, ?, ?)`)
      .run(payload.description, payload.amount, payload.category || 'General', payload.date);

    return { id: result.lastInsertRowid, ...payload };
  });

  ipcMain.handle('investments:getAll', () => {
    return db.prepare(`SELECT * FROM investments ORDER BY date DESC, id DESC`).all();
  });

  ipcMain.handle('investments:create', (_event, payload) => {
    const result = db
      .prepare(`INSERT INTO investments (partner_name, amount, date) VALUES (?, ?, ?)`)
      .run(payload.partner_name, payload.amount, payload.date);

    return { id: result.lastInsertRowid, ...payload };
  });

  ipcMain.handle('sales:getAll', () => {
    return db
      .prepare(`
      SELECT s.*, c.name as customer_name
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      ORDER BY s.id DESC
    `)
      .all();
  });

  ipcMain.handle('sales:create', (_event, payload) => {
    const createSaleTx = db.transaction((salePayload) => {
      for (const item of salePayload.items) {
        const product = db.prepare(`SELECT stock_qty FROM products WHERE id = ?`).get(item.product_id);

        if (!product || product.stock_qty < item.quantity) {
          throw new Error(`Insufficient stock for product ID ${item.product_id}`);
        }
      }

      const saleResult = db
        .prepare(`INSERT INTO sales (customer_id, total_amount, date) VALUES (?, ?, ?)`)
        .run(salePayload.customer_id || null, salePayload.total_amount, salePayload.date);

      const saleId = saleResult.lastInsertRowid;
      const itemStmt = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantity, unit_price)
        VALUES (?, ?, ?, ?)
      `);
      const stockStmt = db.prepare(`UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?`);

      for (const item of salePayload.items) {
        itemStmt.run(saleId, item.product_id, item.quantity, item.unit_price);
        stockStmt.run(item.quantity, item.product_id);
      }

      return saleId;
    });

    const saleId = createSaleTx(payload);

    return { success: true, saleId };
  });

  ipcMain.handle('sales:getItems', (_event, saleId) => {
    return db
      .prepare(`
      SELECT si.*, p.name as product_name
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = ?
    `)
      .all(saleId);
  });

  ipcMain.handle('dashboard:getMetrics', () => getDashboardMetrics());

  ipcMain.handle('invoice:print', async (_event, htmlContent) => {
    const printWindow = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    return new Promise((resolve, reject) => {
      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true,
        },
        (success, errorType) => {
          printWindow.close();
          if (!success && errorType) {
            reject(new Error(errorType));
            return;
          }
          resolve({ success: true });
        }
      );
    });
  });
}
