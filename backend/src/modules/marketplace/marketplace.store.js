const inputCatalog = [
  { id: 'seed-rice-101', type: 'seed', name: 'Paddy Hybrid Seed 10kg', price: 2350, unit: 'bag' },
  { id: 'fert-dap-50', type: 'fertilizer', name: 'DAP 50kg', price: 1450, unit: 'bag' },
  { id: 'fert-urea-45', type: 'fertilizer', name: 'Urea 45kg', price: 300, unit: 'bag' },
  { id: 'bio-neem-1l', type: 'protection', name: 'Neem Oil 1L', price: 420, unit: 'bottle' },
];

const equipmentCatalog = [
  { id: 'rent-tractor-8h', name: 'Tractor with Driver', price: 1600, unit: '8-hours', availability: 'available' },
  { id: 'rent-rotavator', name: 'Rotavator', price: 1200, unit: 'day', availability: 'available' },
  { id: 'rent-sprayer', name: 'Power Sprayer', price: 450, unit: 'day', availability: 'available' },
];

const orderStore = [];

export function listInputs() {
  return inputCatalog;
}

export function listEquipment() {
  return equipmentCatalog;
}

export function addMarketplaceOrder(payload = {}) {
  const order = {
    id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
    userId: String(payload.userId || 'anonymous'),
    itemId: String(payload.itemId || ''),
    quantity: Number(payload.quantity || 1),
    orderType: String(payload.orderType || 'input'),
    status: 'requested',
    createdAt: new Date().toISOString(),
  };
  orderStore.unshift(order);
  if (orderStore.length > 200) {
    orderStore.length = 200;
  }
  return order;
}

export function listOrders(userId = 'anonymous') {
  return orderStore.filter((row) => row.userId === userId).slice(0, 40);
}
