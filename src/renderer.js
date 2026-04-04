const state = {
  cart: [],
  selectedCustomerId: null,
  products: [],
  customers: [],
};

const currency = (value) => `PKR ${Number(value || 0).toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

document.addEventListener('DOMContentLoaded', () => {
  bindNavigation();
  bindForms();
  bindSales();
  bootstrap();
});

async function bootstrap() {
  document.querySelector('#expense-form [name="date"]').value = today();
  document.querySelector('#investment-form [name="date"]').value = today();

  await Promise.all([
    refreshProducts(),
    refreshCustomers(),
    refreshExpenses(),
    refreshInvestments(),
    refreshDashboard(),
  ]);
}

function bindNavigation() {
  const tabs = document.querySelectorAll('.nav-btn');
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    });
  });
}

function bindForms() {
  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);

    await window.api.products.create({
      name: form.get('name'),
      category: form.get('category'),
      purchase_price: Number(form.get('purchase_price')),
      selling_price: Number(form.get('selling_price')),
      stock_qty: Number(form.get('stock_qty')),
    });

    e.target.reset();
    await refreshProducts();
    await refreshDashboard();
  });

  document.getElementById('purchase-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);

    await window.api.inventory.purchase({
      product_id: Number(form.get('product_id')),
      quantity: Number(form.get('quantity')),
    });

    e.target.reset();
    await refreshProducts();
    await refreshDashboard();
  });

  document.getElementById('customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await window.api.customers.create({ name: form.get('name'), phone: form.get('phone') });
    e.target.reset();
    await refreshCustomers();
  });

  document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await window.api.expenses.create({
      description: form.get('description'),
      amount: Number(form.get('amount')),
      category: form.get('category'),
      date: form.get('date'),
    });
    e.target.reset();
    document.querySelector('#expense-form [name="date"]').value = today();
    await refreshExpenses();
    await refreshDashboard();
  });

  document.getElementById('investment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await window.api.investments.create({
      partner_name: form.get('partner_name'),
      amount: Number(form.get('amount')),
      date: form.get('date'),
    });
    e.target.reset();
    document.querySelector('#investment-form [name="date"]').value = today();
    await refreshInvestments();
  });
}

function bindSales() {
  const searchInput = document.getElementById('product-search');
  searchInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    if (!query) {
      renderSearchResults([]);
      return;
    }

    const products = await window.api.products.getAll(query);
    renderSearchResults(products);
  });

  document.getElementById('finalize-sale-btn').addEventListener('click', finalizeSale);
  document.getElementById('print-invoice-btn').addEventListener('click', printInvoice);

  document.getElementById('sale-customer').addEventListener('change', (e) => {
    state.selectedCustomerId = e.target.value ? Number(e.target.value) : null;
  });
}

function renderSearchResults(products) {
  const container = document.getElementById('search-results');
  container.innerHTML = '';

  products.forEach((product) => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.textContent = `${product.name} | ${currency(product.selling_price)} | Stock: ${product.stock_qty}`;
    item.addEventListener('click', () => {
      addItemToCart(product);
      container.innerHTML = '';
      document.getElementById('product-search').value = '';
    });
    container.appendChild(item);
  });
}

function addItemToCart(product) {
  const existing = state.cart.find((item) => item.product_id === product.id);

  if (existing) {
    if (existing.quantity + 1 > product.stock_qty) {
      alert('Stock limit reached for this product.');
      return;
    }
    existing.quantity += 1;
  } else {
    if (product.stock_qty < 1) {
      alert('This product is out of stock.');
      return;
    }
    state.cart.push({
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_price: product.selling_price,
      maxStock: product.stock_qty,
    });
  }

  renderCart();
}

function renderCart() {
  const body = document.getElementById('cart-body');
  body.innerHTML = '';

  state.cart.forEach((item) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${item.product_name}</td>
      <td><input data-id="${item.product_id}" class="qty-input" type="number" min="1" max="${item.maxStock}" value="${item.quantity}" /></td>
      <td>${currency(item.unit_price)}</td>
      <td>${currency(item.unit_price * item.quantity)}</td>
      <td><button data-remove="${item.product_id}">X</button></td>
    `;

    body.appendChild(tr);
  });

  body.querySelectorAll('.qty-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      const target = state.cart.find((item) => item.product_id === Number(e.target.dataset.id));
      const qty = Number(e.target.value);

      if (qty < 1 || qty > target.maxStock) {
        alert(`Quantity must be between 1 and ${target.maxStock}`);
        e.target.value = target.quantity;
        return;
      }

      target.quantity = qty;
      renderCart();
    });
  });

  body.querySelectorAll('button[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.cart = state.cart.filter((item) => item.product_id !== Number(btn.dataset.remove));
      renderCart();
    });
  });

  const total = state.cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  document.getElementById('bill-total').textContent = `Total: ${currency(total)}`;
}

async function finalizeSale() {
  if (!state.cart.length) {
    alert('Add at least one product before finalizing the sale.');
    return;
  }

  const total_amount = state.cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  try {
    await window.api.sales.create({
      customer_id: state.selectedCustomerId,
      total_amount,
      date: today(),
      items: state.cart.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
    });

    alert('Sale finalized successfully.');
    state.cart = [];
    renderCart();
    await refreshProducts();
    await refreshDashboard();
  } catch (error) {
    alert(error.message || 'Failed to finalize sale due to stock issue.');
  }
}

async function printInvoice() {
  if (!state.cart.length) {
    alert('Cart is empty.');
    return;
  }

  const total = state.cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const lines = state.cart
    .map(
      (item) => `<tr><td>${item.product_name}</td><td>${item.quantity}</td><td>${currency(item.unit_price)}</td><td>${currency(item.quantity * item.unit_price)}</td></tr>`
    )
    .join('');

  const html = `
    <html>
      <head>
        <style>
          body { font-family: monospace; width: 300px; margin: 10px auto; }
          h2, p { text-align: center; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          td, th { border-bottom: 1px dashed #222; padding: 4px 2px; text-align: left; }
          .footer { margin-top: 10px; text-align: center; font-size: 11px; }
        </style>
      </head>
      <body>
        <h2>Quetta Ramza center</h2>
        <p>Bike Showroom Invoice</p>
        <p>Date: ${today()}</p>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
          <tbody>${lines}</tbody>
        </table>
        <h3>Total: ${currency(total)}</h3>
        <div class="footer">Lodhi Software House</div>
      </body>
    </html>
  `;

  await window.api.invoice.print(html);
}

async function refreshProducts() {
  const products = await window.api.products.getAll('');
  state.products = products;

  document.getElementById('product-table').innerHTML = products
    .map(
      (p) =>
        `<tr><td>${p.id}</td><td>${p.name}</td><td>${p.category}</td><td>${currency(p.purchase_price)}</td><td>${currency(
          p.selling_price
        )}</td><td>${p.stock_qty}</td></tr>`
    )
    .join('');

  const productOptions = ['<option value="">Select Product</option>']
    .concat(products.map((p) => `<option value="${p.id}">${p.name} (Stock: ${p.stock_qty})</option>`))
    .join('');

  document.getElementById('purchase-product').innerHTML = productOptions;
}

async function refreshCustomers() {
  const customers = await window.api.customers.getAll();
  state.customers = customers;

  document.getElementById('customers-table').innerHTML = customers
    .map((c) => `<tr><td>${c.id}</td><td>${c.name}</td><td>${c.phone || '-'}</td></tr>`)
    .join('');

  document.getElementById('sale-customer').innerHTML = ['<option value="">Walk-in Customer</option>']
    .concat(customers.map((c) => `<option value="${c.id}">${c.name}${c.phone ? ` (${c.phone})` : ''}</option>`))
    .join('');
}

async function refreshExpenses() {
  const expenses = await window.api.expenses.getAll();
  document.getElementById('expenses-table').innerHTML = expenses
    .map((e) => `<tr><td>${e.description}</td><td>${currency(e.amount)}</td><td>${e.category}</td><td>${e.date}</td></tr>`)
    .join('');
}

async function refreshInvestments() {
  const investments = await window.api.investments.getAll();
  document.getElementById('investments-table').innerHTML = investments
    .map((i) => `<tr><td>${i.partner_name}</td><td>${currency(i.amount)}</td><td>${i.date}</td></tr>`)
    .join('');
}

async function refreshDashboard() {
  const metrics = await window.api.dashboard.getMetrics();
  const cards = [
    { label: "Today's Sales", value: currency(metrics.todaySales) },
    { label: 'Total Revenue', value: currency(metrics.totalSalesRevenue) },
    { label: 'COGS', value: currency(metrics.totalCogs) },
    { label: 'Expenses', value: currency(metrics.totalExpenses) },
    { label: 'Current Profit', value: currency(metrics.currentProfit) },
    { label: 'Inventory Value', value: currency(metrics.stockValue) },
  ];

  document.getElementById('dashboard-cards').innerHTML = cards
    .map((card) => `<article class="card"><small>${card.label}</small><h3>${card.value}</h3></article>`)
    .join('');
}
