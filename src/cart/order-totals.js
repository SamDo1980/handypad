// Sum currency minor units from the current source prices; no currency conversion.
export function orderTotals(items, currency = 'USD') {
  const factor = currency === 'VND' ? 1 : 100;
  return {
    lineCount: items.length,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    amount: items.reduce((sum, item) => sum + Math.round(item.unit_price * factor) * item.quantity, 0) / factor,
    currency,
  };
}
