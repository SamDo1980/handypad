export const PRODUCTS = {
  single: {
    name: "HANDYPAD Single",
    dimension: "24 × 10 × 5 cm",
    basePriceVnd: 550000,
    basePriceUsd: 21.15,
    addOns: {
      reflective: { label: "Băng phản quang", priceVnd: 50000, priceUsd: 1.92 },
      fireproof: { label: "Vải bạt chống cháy", priceVnd: 100000, priceUsd: 3.85 },
    },
  },
  double: {
    name: "HANDYPAD Double",
    dimension: "24 × 20 × 5 cm",
    basePriceVnd: 1050000,
    basePriceUsd: 40.38,
    addOns: {
      reflective: { label: "Băng phản quang", priceVnd: 50000, priceUsd: 2.0 },
      fireproof: { label: "Vải bạt chống cháy", priceVnd: 250000, priceUsd: 9.62 },
    },
  },
  one_metre: {
    name: "HANDYPAD 1 Mét",
    dimension: "100 × 24 × 5 cm",
    basePriceVnd: 4650000,
    basePriceUsd: 179.0,
    addOns: {
      reflective: { label: "Băng phản quang", priceVnd: 425000, priceUsd: 16.35 },
      fireproof: { label: "Vải bạt chống cháy", priceVnd: 1250000, priceUsd: 48.08 },
    },
  },
};

const SIZE_CODES = { SGL: "single", DBL: "double", "1M": "one_metre" };

function parseSku(sku) {
  const match = /^HP-(SGL|DBL|1M)-(REF|STD)(-FR)?$/.exec(String(sku || ""));
  if (!match) return null;
  return {
    size: SIZE_CODES[match[1]],
    addOns: [...(match[2] === "REF" ? ["reflective"] : []), ...(match[3] ? ["fireproof"] : [])],
  };
}

export function resolveOrderItems(rawItems) {
  if (!Array.isArray(rawItems)) return { items: [], subtotal: 0, subtotalUsd: 0 };

  const cents = (value) => Math.round(value * 100);
  let subtotal = 0;
  let subtotalUsdCents = 0;
  const items = rawItems
    .map((raw) => {
      const parsed = parseSku(raw?.sku);
      const product = parsed && PRODUCTS[parsed.size];
      if (!product) return null;

      const quantity = Math.max(1, Math.round(Number(raw.quantity) || 1));
      const addOnKeys = parsed.addOns;
      const unitPrice = product.basePriceVnd + addOnKeys.reduce((sum, k) => sum + product.addOns[k].priceVnd, 0);
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;
      const unitUsdCents = cents(product.basePriceUsd) + addOnKeys.reduce((sum, k) => sum + cents(product.addOns[k].priceUsd), 0);
      subtotalUsdCents += unitUsdCents * quantity;

      const variant = [product.dimension, ...addOnKeys.map((k) => product.addOns[k].label)].join(" + ");

      return { sku: raw.sku, name: product.name, variant, quantity, unitPrice, lineTotal, unitPriceUsd: unitUsdCents / 100 };
    })
    .filter(Boolean);

  return { items, subtotal, subtotalUsd: subtotalUsdCents / 100 };
}