// Server-side mirror of the pricing in assets/js/configure-order-v64.js
// (HANDYPAD_PRODUCTS). Kept intentionally small (3 sizes x 2 add-ons).
//
// Why this exists: order line items, unit prices and the subtotal used to be
// computed in the browser and sent to the backend as-is, which means a
// customer could tamper with the total before checkout. Every price here is
// resolved from this catalog instead — the client only tells us which sku /
// add-ons / quantity were picked.
//
// IMPORTANT: if you change a price in HANDYPAD_PRODUCTS on the frontend,
// update the matching number here too, or the storefront display and the
// amount actually charged will disagree.
export const PRODUCTS = {
  single: {
    name: "HANDYPAD Single",
    dimension: "24 × 10 × 5 cm",
    basePriceVnd: 550000,
    addOns: {
      reflective: { label: "Băng phản quang", priceVnd: 50000 },
      fireproof: { label: "Vải bạt chống cháy", priceVnd: 100000 },
    },
  },
  double: {
    name: "HANDYPAD Double",
    dimension: "24 × 20 × 5 cm",
    basePriceVnd: 1050000,
    addOns: {
      reflective: { label: "Băng phản quang", priceVnd: 50000 },
      fireproof: { label: "Vải bạt chống cháy", priceVnd: 250000 },
    },
  },
  one_metre: {
    name: "HANDYPAD 1 Mét",
    dimension: "100 × 24 × 5 cm",
    basePriceVnd: 4650000,
    addOns: {
      reflective: { label: "Băng phản quang", priceVnd: 425000 },
      fireproof: { label: "Vải bạt chống cháy", priceVnd: 1250000 },
    },
  },
};

// rawItems: [{ sku, addOns: [key,...], quantity }, ...] as sent by the client.
// NOTE: the frontend's `sku` is a compound string like "double__reflective"
// or "single__standard" (base product key + addons baked into the string —
// see configurationFromSelection() in configure-order-v64.js). The base
// product key is always the part before "__"; addOns is also sent
// separately and is what we actually use to resolve add-on prices.
// Returns { items, subtotal } with every price resolved server-side.
export function resolveOrderItems(rawItems) {
  if (!Array.isArray(rawItems)) return { items: [], subtotal: 0 };

  let subtotal = 0;
  const items = rawItems
    .map((raw) => {
      const baseSku = String(raw?.sku || "").split("__")[0];
      const product = PRODUCTS[baseSku];
      if (!product) return null;

      const quantity = Math.max(1, Math.round(Number(raw.quantity) || 1));
      const addOnKeys = Array.isArray(raw.addOns) ? raw.addOns.filter((k) => product.addOns[k]) : [];
      const unitPrice = product.basePriceVnd + addOnKeys.reduce((sum, k) => sum + product.addOns[k].priceVnd, 0);
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;

      const variant = [product.dimension, ...addOnKeys.map((k) => product.addOns[k].label)].join(" + ");

      return { name: product.name, variant, quantity, unitPrice, lineTotal };
    })
    .filter(Boolean);

  return { items, subtotal };
}
