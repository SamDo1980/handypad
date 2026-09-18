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
