const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  products: {
    getAll: (search) => ipcRenderer.invoke('products:getAll', search),
    create: (payload) => ipcRenderer.invoke('products:create', payload),
    update: (payload) => ipcRenderer.invoke('products:update', payload),
    delete: (id) => ipcRenderer.invoke('products:delete', id),
  },
  inventory: {
    purchase: (payload) => ipcRenderer.invoke('inventory:purchase', payload),
  },
  customers: {
    getAll: () => ipcRenderer.invoke('customers:getAll'),
    create: (payload) => ipcRenderer.invoke('customers:create', payload),
  },
  sales: {
    getAll: () => ipcRenderer.invoke('sales:getAll'),
    create: (payload) => ipcRenderer.invoke('sales:create', payload),
    getItems: (saleId) => ipcRenderer.invoke('sales:getItems', saleId),
  },
  expenses: {
    getAll: () => ipcRenderer.invoke('expenses:getAll'),
    create: (payload) => ipcRenderer.invoke('expenses:create', payload),
  },
  investments: {
    getAll: () => ipcRenderer.invoke('investments:getAll'),
    create: (payload) => ipcRenderer.invoke('investments:create', payload),
  },
  dashboard: {
    getMetrics: () => ipcRenderer.invoke('dashboard:getMetrics'),
  },
  invoice: {
    print: (htmlContent) => ipcRenderer.invoke('invoice:print', htmlContent),
  },
});
