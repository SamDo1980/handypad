// Prices come straight from the storefront's own catalogue, so the amount charged
// can never drift from the price shown. The browser only sends sku + quantity.
import { products, SIZES, ADD_ONS } from "../../src/data/products.js";

const bySku = new Map(products.map((product) => [product.id, product]));
const sizeById = new Map(SIZES.map((size) => [size.id, size]));

// rawItems: [{ sku, quantity }, ...] -> { items, subtotal (VND), subtotalUsd }
export function resolveOrderItems(rawItems) {
  if (!Array.isArray(rawItems)) return { items: [], subtotal: 0, subtotalUsd: 0 };

  let subtotal = 0;
  let subtotalUsdCents = 0;
  const items = rawItems
    .map((raw) => {
      const product = bySku.get(String(raw?.sku || ""));
      if (!product) return null;

      const quantity = Math.max(1, Math.round(Number(raw.quantity) || 1));
      const unitPrice = product.prices.VND;
      const unitUsdCents = Math.round(product.prices.USD * 100);
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;
      subtotalUsdCents += unitUsdCents * quantity;

      const size = sizeById.get(product.size);
      const variant = [size.dimensions, ...ADD_ONS.filter((addOn) => product[addOn.id]).map((addOn) => addOn.label_vi)].join(" + ");

      return { sku: product.id, name: `HANDYPAD ${size.label_vi}`, variant, quantity, unitPrice, lineTotal, unitPriceUsd: unitUsdCents / 100 };
    })
    .filter(Boolean);

  return { items, subtotal, subtotalUsd: subtotalUsdCents / 100 };
}
