# Quetta Ramza center POS (Electron + SQLite)

Production-ready, beginner-friendly desktop POS for a bike showroom.

## Tech Stack
- **Desktop Runtime:** Electron
- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript (SPA, sidebar UI)
- **Backend:** Electron main process with IPC handlers
- **Database:** SQLite using `better-sqlite3`
- **State:** Global JavaScript object (`state`) in renderer process for cart/billing

## Project Structure

```
.
├── assets/
├── src/
│   ├── index.html
│   ├── styles.css
│   └── renderer.js
├── main.js
├── preload.js
├── database.js
├── package.json
└── README.md
```

## Implemented Modules

1. **Dashboard**
   - Today's sales (`SUM(total_amount)` for current date)
   - Total revenue
   - COGS
   - Expenses
   - Current profit = Revenue - COGS - Expenses
   - Inventory value

2. **Sales Billing Engine**
   - Real-time product search listener
   - Auto uses product selling price when adding to cart
   - Stock validation in UI and inside DB transaction
   - Finalize sale inserts into `sales` + `sale_items` and decrements stock

3. **Inventory**
   - Add products
   - Log purchases using:
     - `UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?`
   - Product stock table

4. **Customers**
   - Add and list customers
   - Assign customer to sale

5. **Expenses and Investments**
   - Record and list expenses
   - Record and list partner investments

6. **Print System**
   - Invoice printing through `webContents.print()` in a hidden BrowserWindow
   - Thermal-style compact invoice layout

7. **Footer Branding**
   - `Lodhi Software House | Contact: muhammadumarkhanlodhi06@gmail.com`

## Database Schema
The database initializes automatically on first run in `ramza-pos.db`.

### `products`
- id
- name
- category (Bike/Scooty)
- purchase_price
- selling_price
- stock_qty

### `sales`
- id
- customer_id
- total_amount
- date

### `sale_items`
- id
- sale_id
- product_id
- quantity
- unit_price

### `customers`
- id
- name
- phone

### `expenses`
- id
- description
- amount
- category
- date

### `investments`
- id
- partner_name
- amount
- date

## Setup Guide (Beginner Friendly)

### 1) Install Node.js
- Install Node.js LTS (18+ recommended).
- Verify:
  ```bash
  node -v
  npm -v
  ```

### 2) Install dependencies
From the project root:
```bash
npm install
```

### 3) Run the desktop app
```bash
npm start
```

### 4) How DB initialization works
- On app startup, `initializeDatabase()` in `database.js` runs automatically.
- If tables do not exist, they are created.
- SQLite file is created at project root as `ramza-pos.db`.

### 5) Production packaging (optional)
You can add Electron Builder later for installers:
```bash
npm install --save-dev electron-builder
```
Then add build config in `package.json`.

## Workflow Example
1. Add products in **Inventory**.
2. Log purchase stock increments from **Log Purchase** form.
3. Search products in **Sales** and add to cart.
4. Select/add customer.
5. Finalize sale (stock decremented).
6. Print invoice.
7. Review profitability in **Dashboard**.

## Notes
- Current date storage uses `YYYY-MM-DD` format.
- Stock checks happen twice:
  - At renderer level (user feedback)
  - In DB transaction (final authority)
