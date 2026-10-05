import { getProductPrice, getProductName } from '../lib/storefront.js';
export const CART_KEY = 'handypad.cart.v1';

function validQuantity(quantity) {
  return Number.isSafeInteger(quantity) && quantity >= 1;
}

export function createCartStore(catalogue, storage, language = 'en') {
  const lines = new Map();
  const subscribers = new Set();
  let persistent = Boolean(storage);

  function snapshot() {
    return [...lines].map(([id, quantity]) => {
      const p = catalogue.getById(id);
      const price = getProductPrice(p, language);
      return {
        id: p.id, display_name: getProductName(p, language), display_name_vi: p.display_name_vi,
        size: p.size, dimensions: p.dimensions_display, reflective: p.reflective, fireproof: p.fireproof,
        unit_price: price.amount, currency: price.currency, prices: { ...p.prices }, quantity, image: p.image_url,
      };
    });
  }

  // Restore identity/quantity only. Current catalogue controls prices and all SKU metadata.
  try {
    const saved = JSON.parse(storage?.getItem(CART_KEY) ?? 'null');
    if (saved?.version === 1 && Array.isArray(saved.items)) {
      for (const line of saved.items) {
        if (!catalogue.getById(line.id) || !validQuantity(line.quantity)) continue;
        const combined = (lines.get(line.id) || 0) + line.quantity;
        if (validQuantity(combined)) lines.set(line.id, combined);
      }
    }
  } catch { /* Invalid saved state must never prevent catalogue use. */ }

  function publish() {
    const items = snapshot();
    try {
      if (storage) storage.setItem(CART_KEY, JSON.stringify({ version: 1, items }));
    } catch { persistent = false; }
    subscribers.forEach(listener => listener(items));
  }

  return {
    getItems: snapshot,
    getCount: () => [...lines.values()].reduce((sum, quantity) => sum + quantity, 0),
    isPersistent: () => persistent,
    add(productOrId, quantity = 1) {
      const id = typeof productOrId === 'string' ? productOrId : productOrId?.id;
      if (!catalogue.getById(id)) throw new Error('This SKU is not in the HANDYPAD catalogue.');
      if (!validQuantity(quantity)) throw new Error('Enter a whole-number quantity of at least 1.');
      const next = (lines.get(id) || 0) + quantity;
      const total = [...lines.values()].reduce((sum, q) => sum + q, 0) + quantity;
      if (!validQuantity(next) || !validQuantity(total)) throw new Error('Quantity is too large.');
      lines.set(id, next);
      publish();
      return snapshot().find(line => line.id === id);
    },
    setQuantity(id, quantity) {
      if (!lines.has(id)) throw new Error('This SKU is not in your order.');
      if (!validQuantity(quantity)) throw new Error('Enter a whole-number quantity of at least 1.');
      const total = [...lines.values()].reduce((sum, q) => sum + q, 0) - lines.get(id) + quantity;
      if (!validQuantity(total)) throw new Error('Quantity is too large.');
      lines.set(id, quantity);
      publish();
    },
    remove(id) {
      if (!lines.delete(id)) return false;
      publish();
      return true;
    },
    subscribe(listener) {
      subscribers.add(listener);
      listener(snapshot());
      return () => subscribers.delete(listener);
    },
  };
}
